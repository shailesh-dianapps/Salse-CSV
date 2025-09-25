const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const SalesRecord = require('../models/sale');
const User = require('../models/user');
const {performance} = require('perf_hooks');

const BATCH_SIZE = 5000;

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('CSV worker connected to MongoDB.'))
    .catch(err => console.error('CSV worker DB error:', err));

process.on('message', async (data) => {
    const {filePath, fileId} = data;
    let buffer = [];
    let totalInserted = 0;
    const startTime = performance.now();

    try{
        const user = await User.findOne({});
        if(!user) throw new Error('No users found in DB. Cannot process CSV.');

        const stream = fs.createReadStream(filePath).pipe(csv());

        stream.on('data', async (row) => {
            buffer.push({
                region: row.Region,
                country: row.Country,
                itemType: row['Item Type'],
                salesChannel: row['Sales Channel'],
                orderPriority: row['Order Priority'],
                orderDate: new Date(row['Order Date']),
                orderId: row['Order ID'],
                shipDate: new Date(row['Ship Date']),
                unitsSold: parseInt(row['Units Sold']),
                unitPrice: parseFloat(row['Unit Price']),
                unitCost: parseFloat(row['Unit Cost']),
                totalRevenue: parseFloat(row['Total Revenue']),
                totalCost: parseFloat(row['Total Cost']),
                totalProfit: parseFloat(row['Total Profit']),
                user: user._id
            });

            if(buffer.length >= BATCH_SIZE){
                stream.pause();
                try{
                    await SalesRecord.insertMany(buffer, {ordered: false});
                    totalInserted += buffer.length;
                    console.log(`Inserted batch of ${buffer.length} records (Total: ${totalInserted})`);
                } 
                catch (batchError){
                    console.error('Error inserting batch:', batchError.message);
                }
                buffer = [];
                stream.resume();
            }
        });

        stream.on('end', async () => {
            if(buffer.length > 0){
                try{
                    await SalesRecord.insertMany(buffer, {ordered: false});
                    totalInserted += buffer.length;
                } 
                catch(finalError){
                    console.error('Error inserting final batch:', finalError.message);
                }
            }

            const endTime = performance.now();
            console.log(`
                Processing completed. Total inserted: ${totalInserted}. Time: ${((endTime - startTime) / 1000).toFixed(2)}s`
            );
            process.send({status: 'completed', fileId, totalInserted});
        });

        stream.on('error', (err) => {
            console.error('CSV stream error:', err.message);
            process.send({status: 'error', fileId, error: err.message});
        });
    } 
    catch(error){
        console.error('Fatal error in CSV worker:', error.message);
        process.send({status: 'error', fileId, error: error.message});
    }
});
