// controllers/agencyController.js
const Agency = require('../models/Agency');
exports.list = (req,res) => Agency.find().then(list => res.json(list));
exports.get = (req,res) => Agency.findById(req.params.id).then(a=>res.json(a));
exports.create = (req,res) => Agency.create(req.body).then(a=>res.json(a));
exports.update = (req,res) => Agency.findByIdAndUpdate(req.params.id,req.body,{new:true}).then(a=>res.json(a));
exports.remove = (req,res) => Agency.findByIdAndDelete(req.params.id).then(()=>res.json({message:'Deleted'}));