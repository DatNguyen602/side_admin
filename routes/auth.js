// routes/auth.js
const router = require("express").Router();
const { register, login } = require("../controllers/authController");
const validate = require("../middleware/validate");
const Joi = require("joi");
router.post(
    "/register",
    validate(
        Joi.object({
            username: Joi.string().required(),
            password: Joi.string().required(),
            roleName: Joi.string().required(),
            agencyId: Joi.string().required(),
        })
    ),
    register
);
router.post(
    "/login",
    validate(
        Joi.object({
            username: Joi.string().required(),
            password: Joi.string().required(),
        })
    ),
    login
);
module.exports = router;
