const User = require('../models/user');
const Session = require('../models/session');
const jwt = require('jsonwebtoken');

exports.registerUser = async (req, res) => {
    try{
        const {username, password} = req.body;
        const user = new User({username, password});
        await user.save();

        res.status(201).json({message: 'User registered successfully!'});
    } 
    catch(error){
        if(error.code === 11000){
            return res.status(409).json({error: 'Username already exists.'});
        }
        console.error('Register error:', error.message);
        res.status(500).json({error: 'User registration failed.'});
    }
};

exports.loginUser = async (req, res) => {
    try{
        const {username, password} = req.body;

        const user = await User.findOne({username});
        if(!user){
            return res.status(401).json({error: 'Invalid credentials or user is deactivated.'});
        }

        const isMatch = await user.comparePassword(password);
        if(!isMatch){
            return res.status(401).json({error: 'Invalid credentials.'});
        }

        const token = jwt.sign({id: user._id, username: user.username}, process.env.JWT_SECRET, {expiresIn: '1d'});
        await Session.create({user: user._id, token});

        res.json({token, userId: user._id, username: user.username});
    } 
    catch(error){
        console.error('Login error:', error.message);
        res.status(500).json({error: 'Login failed.'});
    }
};

exports.logoutUser = async (req, res) => {
    try{
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];

        if(!token){
            return res.status(400).json({error: "No token provided"});
        }

        await Session.deleteOne({ token });
        res.json({message: 'Logged out successfully.'});
    } 
    catch(error){
        console.error('Logout error:', error.message);
        res.status(500).json({error: 'Logout failed.'});
    }
};

