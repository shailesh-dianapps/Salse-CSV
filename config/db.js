const mongoose = require('mongoose');

const connectDB = async () => {
    try{
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MONGODB connected');
    } 
    catch(err){
        console.error('MONGODB connection FAILED:', err);
        process.exit(1);
    }
};

module.exports = connectDB;
