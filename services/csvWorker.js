// const fs = require('fs');
// const csv = require('csv-parser');
// const mongoose = require('mongoose');
// const SalesRecord = require('../models/sale');
// const User = require('../models/user');
// const {performance} = require('perf_hooks');

// const BATCH_SIZE = 5000;

// mongoose.connect(process.env.MONGODB_URI)
//     .then(() => console.log('CSV worker connected to MongoDB.'))
//     .catch(err => console.error('CSV worker DB error:', err));

// process.on('message', async (data) => {
//     const {filePath, fileId} = data;
//     let buffer = [];
//     let totalInserted = 0;
//     const startTime = performance.now();

//     try{
//         const user = await User.findOne({});
//         if(!user) throw new Error('No users found in DB. Cannot process CSV.');

//         const stream = fs.createReadStream(filePath).pipe(csv());

//         stream.on('data', async (row) => {
//             buffer.push({
//                 region: row.Region,
//                 country: row.Country,
//                 itemType: row['Item Type'],
//                 salesChannel: row['Sales Channel'],
//                 orderPriority: row['Order Priority'],
//                 orderDate: new Date(row['Order Date']),
//                 orderId: row['Order ID'],
//                 shipDate: new Date(row['Ship Date']),
//                 unitsSold: parseInt(row['Units Sold']),
//                 unitPrice: parseFloat(row['Unit Price']),
//                 unitCost: parseFloat(row['Unit Cost']),
//                 totalRevenue: parseFloat(row['Total Revenue']),
//                 totalCost: parseFloat(row['Total Cost']),
//                 totalProfit: parseFloat(row['Total Profit']),
//                 user: user._id
//             });

//             if(buffer.length >= BATCH_SIZE){
//                 stream.pause();
//                 try{
//                     await SalesRecord.insertMany(buffer, {ordered: false});
//                     totalInserted += buffer.length;
//                     console.log(`Inserted batch of ${buffer.length} records (Total: ${totalInserted})`);
//                 } 
//                 catch (batchError){
//                     console.error('Error inserting batch:', batchError.message);
//                 }
//                 buffer = [];
//                 stream.resume();
//             }
//         });

//         stream.on('end', async () => {
//             if(buffer.length > 0){
//                 try{
//                     await SalesRecord.insertMany(buffer, {ordered: false});
//                     totalInserted += buffer.length;
//                 } 
//                 catch(finalError){
//                     console.error('Error inserting final batch:', finalError.message);
//                 }
//             }

//             const endTime = performance.now();
//             console.log(`
//                 Processing completed. Total inserted: ${totalInserted}. Time: ${((endTime - startTime) / 1000).toFixed(2)}s`
//             );
//             process.send({status: 'completed', fileId, totalInserted});
//         });

//         stream.on('error', (err) => {
//             console.error('CSV stream error:', err.message);
//             process.send({status: 'error', fileId, error: err.message});
//         });
//     } 
//     catch(error){
//         console.error('Fatal error in CSV worker:', error.message);
//         process.send({status: 'error', fileId, error: error.message});
//     }
// });





const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const SalesRecord = require('../models/sale');
const User = require('../models/user');
const { performance } = require('perf_hooks');

const BATCH_SIZE = 5000;

(async () => {
    try{
        await mongoose.connect(workerData.mongoUri, {autoIndex: false, maxPoolSize: 20});
        console.log('Worker connected to MongoDB.');
        await processChunk();
    } 
    catch(err){
        console.error('Worker DB connection failed:', err.message);
        parentPort.postMessage({status: 'error', error: err.message});
    }
})();

async function processChunk() {
    const {filePath, startLine, endLine} = workerData;
    let buffer = [];
    let totalProcessed = 0;
    let currentLine = 0;

    const processBatch = async (batch) => {
        if(!batch.length) return;

        const ops = batch.map(doc => ({
            updateOne: {
                filter: {orderId: doc.orderId},
                update: {$set: doc},
                upsert: true
            }
        }));

        try{
            const result = await SalesRecord.bulkWrite(ops, {ordered: false});
            const insertedCount = result.insertedCount || 0;
            const upsertedCount = result.upsertedCount || 0;

            totalProcessed += insertedCount + upsertedCount;

            console.log(`Worker batch inserted: ${batch.length} docs. Total processed: ${totalProcessed}`);

            if(insertedCount + upsertedCount < batch.length){
                console.log(`Duplicate records detected in this batch.`);
            }
        } 
        catch(err){
            console.error('BulkWrite failed:', err.message);
        }
    };

    try{
        const user = await User.findOne({});
        if(!user) throw new Error('No users found in DB.');

        const stream = fs.createReadStream(filePath).pipe(csv());

        stream.on('data', async (row) => {
            currentLine++;
            if (currentLine <= startLine) return;
            if (currentLine > endLine) return stream.destroy();

            buffer.push({
                region: row.Region,
                country: row.Country,
                itemType: row['Item Type'],
                salesChannel: row['Sales Channel'],
                orderPriority: row['Order Priority'],
                orderDate: new Date(row['Order Date']),
                orderId: parseInt(row['Order ID']),
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
                await processBatch(buffer);
                buffer = [];
                stream.resume();
            }
        });

        stream.on('end', async () => {
            if(buffer.length > 0) await processBatch(buffer);

            const endTime = performance.now();
            console.log(`Worker chunk ${startLine}-${endLine} finished in ${((endTime - performance.timeOrigin)/1000).toFixed(2)}s. Total processed: ${totalProcessed}`);
            parentPort.postMessage({status: 'completed', totalProcessed});
        });

        stream.on('error', (err) => {
            console.error('CSV stream error:', err.message);
            parentPort.postMessage({status: 'error', error: err.message});
        });
    } 
    catch(error){
        parentPort.postMessage({status: 'error', error: error.message});
    }
}
