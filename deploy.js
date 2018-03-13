const s3 = require('s3')
const AWS = require('aws-sdk')
const fs = require('fs')
const path = require('path')
const argv = require('minimist')(process.argv.slice(2))
const ora = require('ora')
const dotenv = require('dotenv')

const config = dotenv.config().parsed

const allowedACL = ['private', 'public-read', 'public-read-write', 'authenticated-read', 'aws-exec-read', 'bucket-owner-read', 'bucker-owner-full-control']

if (!config) {
    console.error('Missing .env file')
    process.exit(1)
}

if (!config.hasOwnProperty('aws_access_key_id')) {
    console.error('Missing "aws_access_key_id" in .env')
    process.exit(1)
}

if (!config.hasOwnProperty('aws_secret_access_key')) {
    console.error('Missing "aws_secret_access_key" in .env')
    process.exit(1)    
}

const accessKey = config.aws_access_key_id
const secretKey = config.aws_secret_access_key

let bucketName = ''
let bucketRegion = ''
let baseFilePath = ''
let cwd = ''

var allParametersRequired = true
var mandatoryParameters = ['file', 'bucket', 'region', 'cwd']
mandatoryParameters.forEach(parameter => {
    if (!argv.hasOwnProperty(parameter)) {
        console.error(`Parameter ${parameter} is missing`)
        allParametersRequired = false
    }
})

const ACL = 'public-read'
if (argv.hasOwnProperty('ACL')) {
    if (allowedACL.indexOf(argv.ACL) !== -1) {
        ACL = argv.ACL
    } else {
        console.error('ACL is not in the list of allowed ACL. Using default ("public-read")')
    }
}

if (!allParametersRequired) {
    console.log('Aborting script due to missing parameters')
    process.exit(1)
}

baseFilePath = path.resolve(argv.file)
bucketName = argv.bucket
bucketRegion = argv.region
cwd = argv.cwd

const awsS3Client = new AWS.S3({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region: bucketRegion
})
const client = s3.createClient({
    s3Client: awsS3Client
})

console.log(`Starting the deployment to S3 bucket : ${bucketName} (${bucketRegion})`)

var isDir = false
var fileName = ''
fs.open(baseFilePath, 'r', (error, fd) => {
    if (error) {
        console.error('Error reading the file or directory')
        process.exit(1)
    }

    fs.fstat(fd, (error, stat) => {
        if (error) {
            console.error('Error reading stats of file or directory')
            process.exit(1)
        }

        isDir = stat.isDirectory()
        if (!isDir) {
            var spinner = ora('Start uploading')
            spinner.start()
    
            startUpload(filePath)
            .then(() => {
                spinner.stop()
                process.exit(0)
            })
            .catch(error => {
                console.error(error)
                process.exit(1)
            })

        } else {
            var files = walkSync(baseFilePath)
            

            processUploadDir(files, null)
            .then(() => {
                process.exit(0)
            })
            .catch(error => {
                console.error(error)
                process.exit(1)
            })
        }

        fs.close(fd, (error) => {
            if (error) {
                console.error('Error closing the file descriptor')
                process.exit(1)
            }

        })
    })
})

/**
 * Upload file or directory content to specified bucket name and region
 * 
 * @param {String} filepath - File path of the file to uploader
 * @returns {Promise}
 */
const startUpload = (filepath, fromDirectory) => {
    return new Promise((resolve, reject) => {
        var fileName = path.basename(filepath)

        var spinner = ora('Start uploading ' + fileName)
        spinner.start()

        var uploadParams = {
            s3Params: {
                Bucket: bucketName,
                ACL
            }
        }

        var s3Key = cwd
        if (fromDirectory) {
            s3Key += fromDirectory
        }
        s3Key += fileName

        uploadParams.s3Params.Key = s3Key
        uploadParams.localFile = filepath

        var uploader = client.uploadFile(uploadParams);
        uploader.on('error', function(err) {
            spinner.stop()
            return reject(err.stack)
        })
        uploader.on('end', function() {
            spinner.stop()
            console.log(`Uploaded ${fileName} to ${s3Key.replace(fileName, '')}`)
            return resolve()
        })
    })
}

/**
 * List all the files inside a directory
 * 
 * @param {String} dir 
 * @param {*} filelist 
 */
const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        filelist = fs.statSync(path.join(dir, file)).isDirectory()
            ? walkSync(path.join(dir, file), filelist)
            : filelist.concat(path.join(dir, file))
    })

    return filelist
}

/**
 * 
 * @param {Array<String>} files 
 * @param {Promise} promise 
 * @returns {Promise}
 */
const processUploadDir = (files, promise) => {
    if (!files) {
        return Promise.resolve({done: true})
    }

    if (!promise) {
        let filePath = files.shift()
        if (filePath) {
            let fromDirectoryPath = filePath.replace(baseFilePath + '/', '').replace(path.basename(filePath), '')

            return processUploadDir(files, startUpload(filePath, fromDirectoryPath))
        } else {
            return Promise.resolve({done: true})
        }
        
    } else {
        return promise
        .catch(error => {
            return Promise.reject(error)
        })
        .then(() => {
            if (files.length > 0) {
                let filePath = files.shift()
                let fromDirectoryPath = filePath.replace(baseFilePath + '/', '').replace(path.basename(filePath), '')

                return processUploadDir(files, startUpload(filePath, fromDirectoryPath))
            } else {
                return Promise.resolve({done: true})
            }
        })
    }
}