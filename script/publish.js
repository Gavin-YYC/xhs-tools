import qiniu from 'qiniu'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')

// 七牛云配置
const accessKey = process.env.QINIU_ACCESS_KEY
const secretKey = process.env.QINIU_SECRET_KEY
const bucket = process.env.QINIU_BUCKET
const zone = 'z0' // 根据你的存储区域选择，如华东z0，华北z1，华南z2等

if (!accessKey || !secretKey || !bucket) {
  console.error('请设置七牛云的环境变量: QINIU_ACCESS_KEY, QINIU_SECRET_KEY, QINIU_BUCKET')
  process.exit(1)
}

// 创建鉴权对象
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey)
const config = new qiniu.conf.Config({
  zone: qiniu.zone[zone],
})

// 创建表单上传对象
const formUploader = new qiniu.form_up.FormUploader(config)
const putExtra = new qiniu.form_up.PutExtra()

// 递归获取所有文件
function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList)
    } else {
      fileList.push(filePath)
    }
  })

  return fileList
}

// 上传文件到七牛云
async function uploadFile(localFile, key) {
  return new Promise((resolve, reject) => {
    const putPolicy = new qiniu.rs.PutPolicy({
      scope: `${bucket}:${key}`,
      insertOnly: 0,
    })
    const uploadToken = putPolicy.uploadToken(mac)
    formUploader.putFile(uploadToken, key, localFile, putExtra, (err, body, info) => {
      if (err) {
        reject(err)
        return
      }

      if (info.statusCode === 200) {
        console.log(`上传成功: ${key}`)
        resolve(body)
      } else {
        console.error(`上传失败详情:`, info.data)
        reject(
          new Error(
            `上传失败: ${key}, 状态码: ${info.statusCode}, 错误: ${info.data ? JSON.stringify(info.data) : '未知'}`
          )
        )
      }
    })
  })
}

// 主函数
async function main() {
  try {
    console.log('开始上传文件到七牛云...')
    const files = getAllFiles(distDir)

    for (const file of files) {
      // 计算相对于dist目录的路径作为七牛云中的key
      const key = path.relative(distDir, file).replace(/\\/g, '/')
      const newKey = process.env.URL_PREFIX_PATH + '/' + key
      await uploadFile(file, newKey)
    }

    console.log('所有文件上传完成！')
  } catch (error) {
    console.error('上传过程中发生错误:', error)
    process.exit(1)
  }
}

// 执行上传
main()
