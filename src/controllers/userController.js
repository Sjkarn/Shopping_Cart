
const { isValid } = require('../validators/validation')
const UserModel = require('../models/usermodel')
const validator = require('validator')
const { uploadFile } = require('../aws/s3Service')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const ObjectId = require('mongoose').Types.ObjectId

const createUser = async (req, res) => {
  try {
    let data = req.body;
    let files = req.files;
    let fields = Object.keys(data);
    if (fields.length == 0) return res.status(400).send({ status: false, message: "Please provide data for create the user." });


    if (!isValid(data.fname)) return res.status(400).send({ status: false, message: "fname is mandatory" });
    if (parseInt(data.fname)) return res.status(400).send({ status: false, message: "give valid name" });

    if (!isValid(data.lname)) return res.status(400).send({ status: false, message: "lname is mandatory" });
    if (parseInt(data.lname)) return res.status(400).send({ status: false, message: "give valid last name" });
    //check validation for email ---------------------------------------------------------------
    if (!isValid(data.email)) return res.status(400).send({ status: false, message: "email is mandatory" });
    if (!validator.isEmail(data.email)) return res.status(400).send({ status: false, msg: "please enter valid email address!" })

    if (files.length == 0) return res.status(400).send({ status: false, message: "profile image  is mandatory" });

    // phone validation ---------------------------------------------
    if (!isValid(data.phone)) return res.status(400).send({ status: false, message: "phone is mandatory" });
    if (!(data.phone.match(/^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/))) return res.status(400).send({ status: false, message: "phone number is not valid" })
    if(data.phone.length==10) data.phone='91'+data.phone


    /*----------------------------------- Checking Unique -----------------------------*/

    const email = await UserModel.findOne({ email: data.email });
    if (email) return res.status(400).send({ status: false, message: "email already exist" })

    const phone = await UserModel.findOne({ phone: data.phone });
    if (phone) return res.status(400).send({ status: false, message: "phone already exist" })


    // password validation --------------------------------
    if (!isValid(data.password)) return res.status(400).send({ status: false, message: "password is mandatory" });
    if (data.password.length < 8 || data.password.length > 15) return res.status(400).send({ status: false, message: "password length should be in range 8-15" });
    if (!(data.password.match(/.*[a-zA-Z]/))) return res.status(400).send({ status: false, error: "Password should contain alphabets" }) // password must be alphabetic //
    if (!(data.password.match(/.*\d/))) return res.status(400).send({ status: false, error: "Password should contain digits" })// we can use number also //
    // encrypt the password
    const saltRounds = 10 //default
    bcrypt.hash(data.password, saltRounds, function (err, hash) {
      if (err) return res.status(400).send({ status: false, message: "invalid password" })
      else data.password = hash
    });



    if (!isValid(data.address.shipping.street)) return res.status(400).send({ status: false, message: "shipping address street is mandatory" });
    if (!isValid(data.address.shipping.city)) return res.status(400).send({ status: false, message: "shipping address city is mandatory" });
    if (!data.address.shipping.pincode) return res.status(400).send({ status: false, message: "shipping address pincode is mandatory" });
    if (parseInt(data.address.shipping.pincode) != data.address.shipping.pincode) return res.status(400).send({ status: false, message: "shipping address pincode should only be Number" });

    if (!isValid(data.address.billing.street)) return res.status(400).send({ status: false, message: "billing address street is mandatory" });
    if (!isValid(data.address.billing.city)) return res.status(400).send({ status: false, message: "billing address city is mandatory" });
    if (!data.address.billing.pincode) return res.status(400).send({ status: false, message: "billing address pincode is mandatory" });
    if (parseInt(data.address.billing.pincode) != data.address.billing.pincode) return res.status(400).send({ status: false, message: "billing address pincode should only be Number" });


    data.fname = data.fname.toLowerCase();
    data.lname = data.lname.toLowerCase()
    data.email = data.email.toLowerCase()



    /*-----------------------------------upload files on s3 storage and getting the link----------------------------------------------------*/

    if (files.length > 0) {
      uploadedFileURL = await uploadFile(files[0]);
    } else {
      return res.status(400).send({ status: false, message: "No file found, it is mandatory" });
    }
    data.profileImage = uploadedFileURL
    /*---------------------------------------------------------------------------------------*/
    let createUser = await UserModel.create(data);

    return res.status(201).send({ status: true, message: `This user is created sucessfully.`, data: createUser, });
  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });
  }
};




const login = async function (req, res) {
  try {
    let body = req.body
    if (Object.keys(body).length == 0) return res.status(400).send({ status: false, message: "Please enter some data" })
    if (!body.email || !body.password) return res.status(400).send({ status: false, message: "Please enter email and password" })

    let findUser = await UserModel.findOne({ email: body.email })
    if (!findUser) return res.status(400).send({ status: false, message: "Invalid email or password" })
    bcrypt.compare(body.password, findUser.password, function (err, result) {  // Compare
      // if passwords match
      if (result) {
        let token = jwt.sign({ userId: findUser._id }, "Secret-key", { expiresIn: "24h" })
        return res.status(200).send({ status: true, message: "User login successfull", data: { userId: findUser._id, token } })
      }
      // if passwords do not match
      else {
        return res.status(400).send({ status: false, message: "Invalid email or password" })
      }
    })

  } catch (error) {
    return res.status(500).send({ status: false, message: error.message });

  }
}







const getUser = async function (req, res) {
  try{
    const userId = req.params.userId
    if(!ObjectId.isValid(userId)) return res.status(400).send({status:false,message:"user objectId is not valid"})
    const userData = await UserModel.findById(userId)
    if (!userData) return res.status(404).send({ status: true, message: "User not found" })
    res.status(200).send({ status: true, message: "User profile details", data: userData })
  }
  catch(err){
    return res.status(500).send({ status: false, message: error.message });
  }
}







const updateUser = async function (req, res) {
  try{
    const userId = req.params.userId
    if(!ObjectId.isValid(userId)) return res.status(400).send({status:false,message:"user objectId is not valid"})
    const updationDetails= req.body
    const file=req.files
    if(Object.keys(updationDetails).length==0) return res.status(400).send({status:false,message:"please provide details for updation"})
    const userData = await UserModel.findById(userId)
    if (!userData) return res.status(404).send({ status: true, message: "User not found" })
  
    if(updationDetails.fname=="") return res.status(400).send({status:false,message:"you can not update the fname with empty string"})
    if(updationDetails.fname){
      if(!updationDetails.fname.trim()) return res.status(400).send({status:false,message:"you can not update the fname with empty string"})
      if(parseInt(updationDetails.fname)) return res.status(400).send({status:false,message:"you can not update invalid fname"})
    }

    if(updationDetails.lname=="") return res.status(400).send({status:false,message:"you can not update the lname with empty string"})
    if(updationDetails.lname){
      if(!updationDetails.lname.trim()) return res.status(400).send({status:false,message:"you can not update the lname with empty string"})
      if(parseInt(updationDetails.lname)) return res.status(400).send({status:false,message:"you can not update invalid lname"})
    }
    
    if(updationDetails.email=="") return res.status(400).send({status:false,message:"you can not update the email with empty "})
    if(updationDetails.email){
      if (!validator.isEmail(updationDetails.email)) return res.status(400).send({ status: false, msg: "please enter valid email address!" })
      
      const user = await UserModel.findOne({email:updationDetails.email})
      if(user) return res.status(400).send({status:false,message:"email already exist"})
    }

    if(updationDetails.phone=="") return res.status(400).send({status:false,message:"you can not update the phone with empty"})
    if(updationDetails.phone){
      
      if (!(updationDetails.phone.match(/^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/))) return res.status(400).send({ status: false, message: "phone number is not valid" })
      if(updationDetails.phone.length==10) updationDetails.phone='91'+updationDetails.phone
      const user = await UserModel.findOne({phone:updationDetails.phone})
      if(user) return res.status(400).send({status:false,message:"phone already exist"})
    }
    
    if(file.length>0){ 
      const profileLink = await uploadFile(file[0])
      updationDetails.profileImage=profileLink
      
    }

    if(updationDetails.password=="") return res.status(400).send({status:false,message:"you can not update the password with empty string"})
    if(updationDetails.password){
      if (updationDetails.password.length < 8 || updationDetails.password.length > 15) return res.status(400).send({ status: false, message: "password length should be in range 8-15" });
      if (!(updationDetails.password.match(/.*[a-zA-Z]/))) return res.status(400).send({ status: false, error: "Password should contain alphabets" }) // password must be alphabetic //
      if (!(updationDetails.password.match(/.*\d/))) return res.status(400).send({ status: false, error: "Password should contain digits" })// we can use number also //
      // encrypt the password
      const saltRounds = 10 //default
      bcrypt.hash(updationDetails.password, saltRounds, function (err, hash) {
        if (err) return res.status(400).send({ status: false, message: "invalid password" })
        else updationDetails.password = hash
      });
    }
    if(updationDetails.address.shipping.street=="") return res.status(400).send({status:false,message:"you can not update the shipping street with empty string"})
    if(updationDetails.address.shipping.city=="") return res.status(400).send({status:false,message:"you can not update the shipping city with empty string"})
    if(updationDetails.address.shipping.pincode=="") return res.status(400).send({status:false,message:"you can not update the shipping pincode with empty string"})
    if(updationDetails.address.shipping.street){
      if(!(updationDetails.address.shipping.street).trim())  return res.status(400).send({status:false,message:"you can not update the shipping street with empty "})
    }
    if(updationDetails.address.shipping.city){
      if(!(updationDetails.address.shipping.city).trim())  return res.status(400).send({status:false,message:"you can not update the shipping city with empty "})
    }
    if(updationDetails.address.shipping.pincode){
      if(!(updationDetails.address.shipping.pincode).trim())  return res.status(400).send({status:false,message:"you can not update the shipping pincode with empty "})
      if(parseInt(updationDetails.address.shipping.pincode)!=updationDetails.address.shipping.pincode) return res.status(400).send({status:false,message:"shipping pincode is invalid"})
    }
  
  

    if(updationDetails.address.billing.street=="") return res.status(400).send({status:false,message:"you can not update the billing street with empty string"})
    if(updationDetails.address.billing.city=="") return res.status(400).send({status:false,message:"you can not update the billing city with empty string"})
    if(updationDetails.address.billing.pincode=="") return res.status(400).send({status:false,message:"you can not update the billing pincode with empty string"})
    if(updationDetails.address.billing.street){
      if(!(updationDetails.address.billing.street).trim())  return res.status(400).send({status:false,message:"you can not update the billing street with empty "})
    }
    if(updationDetails.address.billing.city){
      if(!(updationDetails.address.billing.city).trim())  return res.status(400).send({status:false,message:"you can not update the billing city with empty "})
    }
    if(updationDetails.address.billing.pincode){
      if(!(updationDetails.address.billing.pincode).trim())  return res.status(400).send({status:false,message:"you can not update the billing pincode with empty "})
      if(parseInt(updationDetails.address.billing.pincode)!=updationDetails.address.shipping.pincode) return res.status(400).send({status:false,message:"billing pincode is invalid"})
    }
  
    const updatedUser =await UserModel.findByIdAndUpdate(userId,updationDetails,{new:true})
    res.status(200).send({status:true,message:"User profile updated",data:updatedUser})
  }
  catch(err){
    res.status(500).send({status:false,message:err.message})
  }

}



module.exports.createUser = createUser
module.exports.login = login
module.exports.getUser = getUser
module.exports.updateUser = updateUser
