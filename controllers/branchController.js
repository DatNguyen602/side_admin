// controllers/branchController.js
const Branch = require('../models/Branch');
exports.list = (req,res) => Branch.find().populate('agency').then(list=>res.json(list));
exports.get = (req,res) => Branch.findById(req.params.id).populate('agency').then(b=>res.json(b));
exports.create = (req,res) => Branch.create(req.body).then(b=>res.json(b));
exports.update = (req,res) => Branch.findByIdAndUpdate(req.params.id,req.body,{new:true}).then(b=>res.json(b));
exports.remove = (req,res) => Branch.findByIdAndDelete(req.params.id).then(()=>res.json({message:'Deleted'}));