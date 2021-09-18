import aws from "aws-sdk"
import dotenv from "dotenv"
import crypto from "crypto"
import { promisify } from "util"

const randomBytes = promisify(crypto.randomBytes)
//require('dotenv').config({ path:  '.env'})

dotenv.config()

const region = "us-west-1"
const bucketName = "otterwater"
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_KEY
const s3 = new aws.S3({
    region,
    accessKeyId,
    secretAccessKey,
    signatureVersion: 'v4'
})

export async function generateUploadURL(){
    //unique name; cannot collide with any other image names in the bucket (use rng name)
    const rawBytes = await randomBytes(16)
    const imageName = rawBytes.toString("hex")

    const params = ({
        Bucket: bucketName,
        Key: imageName,
        Expires: 60
    })

    const uploadURL = await s3.getSignedUrlPromise("putObject",params)
    return uploadURL
}

