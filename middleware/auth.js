const jwt = require('jsonwebtoken');
const Session = require('../models/session');

async function authenticate(req, res, next) {
    try{
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1];
        if(!token) return res.status(401).json({error: "No token provided"});

        let payload;
        try{
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } 
        catch(err){
            return res.status(403).json({error: "Invalid token"});
        }

        const session = await Session.findOne({user: payload.id, token});
        if(!session){
            return res.status(401).json({error: "Session expired or replaced"});
        }

        req.user = {_id: payload.id, username: payload.username};
        next();
    } 
    catch(err){
        console.error(err);
        return res.status(500).json({message: err.message});
    }
}

module.exports = {authenticate};
