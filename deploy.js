var s3 = require('s3')
var AWS = require('aws-sdk')
var fs = require('fs')
var path = require('path')
var argv = require('minimist')(process.argv.slice(2))
var ora = require('ora')
var dotenv = require('dotenv')

var config = dotenv.config().parsed

var allowedACL = ['private', 'public-read', 'public-read-write', 'authenticated-read', 'aws-exec-read', 'bucket-owner-read', 'bucker-owner-full-control']

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

var accessKey = config.aws_access_key_id
var secretKey = config.aws_secret_access_key

var bucketName = ''
var bucketRegion = ''
var file = ''
var cwd = ''

var allParametersRequired = true
var mandatoryParameters = ['file', 'bucket', 'region', 'cwd']
mandatoryParameters.forEach(parameter => {
    if (!argv.hasOwnProperty(parameter)) {
        console.error(`Parameter ${parameter} is missing`)
        allParametersRequired = false
    }
})

var ACL = 'public-read'
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

file = path.resolve(argv.file)
bucketName = argv.bucket
bucketRegion = argv.region
cwd = argv.cwd

console.log(`Starting the deployment to S3 bucket : ${bucketName} (${bucketRegion})`)

var isDir = false
var fileName = ''
fs.open(file, 'r', (error, fd) => {
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
            fileName = path.basename(file)
        }
        fs.close(fd, (error) => {
            if (error) {
                console.error('Error closing the file descriptor')
                process.exit(1)
            }

            startUpload()
        })
    })
})

/**
 * Upload file or directory content to specified bucket name and region
 */
function startUpload () {

    var awsS3Client = new AWS.S3({
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
        region: bucketRegion
    })
    var client = s3.createClient({
        s3Client: awsS3Client
    })

    var uploadParams = {
        s3Params: {
            Bucket: bucketName,
            ACL
        }
    }

    var spinner = ora('Start uploading')
    spinner.start()

    if (isDir) {
        uploadParams.localDir = file

        if (cwd && cwd !== '') {
            uploadParams.s3Params.Prefix = cwd
        }

        var uploader = client.uploadDir(uploadParams);
        uploader.on('error', function(err) {
            console.error("unable to sync:", err.stack)
            spinner.stop()
        })
        uploader.on('end', function() {
            spinner.stop()
            console.log("Deployment done")
        })    
    } else {
        uploadParams.localFile = file
        uploadParams.s3Params.Key = cwd + fileName

        var uploader = client.uploadFile(uploadParams);
        uploader.on('error', function(err) {
            console.error("unable to download:", err.stack);
            spinner.stop()
        })
        uploader.on('end', function() {
            spinner.stop()
            console.log("Deployment done")
        })
    }
}
