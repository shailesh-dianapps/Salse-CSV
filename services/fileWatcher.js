// const chokidar = require('chokidar');
// const path = require('path');
// const fs = require('fs/promises');
// const {fork} = require('child_process');
// const FileEntry = require('../models/fileEntry');

// function setupFileWatcher(folderPath) {
//     const watcher = chokidar.watch(folderPath, {
//         ignored: /^\./,       // ignore dotfiles
//         persistent: true,
//         ignoreInitial: true,  // ignore existing files at startup
//     });

//     watcher.on('add', async (filePath) => {
//         const resolvedPath = path.resolve(filePath);
//         const filename = path.basename(resolvedPath);
//         console.log(`New file detected: ${filename}`);                             

//         try{
//             const existingEntry = await FileEntry.findOne({filename});
//             if(existingEntry){
//                 console.log(`File ${filename} already processed. Skipping.`);
//                 return;
//             }

//             const fileEntry = await FileEntry.create({
//                 filename,
//                 folderPath: path.dirname(resolvedPath)
//             });
//             console.log(`Created DB entry for ${filename}.`);

//             const child = fork(path.join(__dirname, 'csvWorker.js'));
//             child.send({filePath: resolvedPath, fileId: fileEntry._id});

//             child.on('message', async (message) => {
//                 if(message.status === 'completed'){
//                     console.log(`Processing of ${filename} completed. Inserted: ${message.totalInserted}`);
//                     await FileEntry.findByIdAndUpdate(message.fileId, {
//                         processed: true,
//                         processedAt: new Date(),
//                         recordCount: message.totalInserted
//                     });
//                     await fs.unlink(resolvedPath);
//                     console.log(`File ${filename} deleted.`);
//                     child.kill();
//                 } 
//                 else if(message.status === 'error'){
//                     console.error(`Error processing ${filename}: ${message.error}`);
//                     await FileEntry.findByIdAndUpdate(message.fileId, {errorLog: message.error});
//                     child.kill();
//                 }
//             });

//             child.on('error', (err) => {
//                 console.error(`Child process error for ${filename}:`, err);
//             });

//             child.on('exit', (code, signal) => {
//                 if(code !== 0) console.warn(`Child process exited with code ${code} (${signal})`);
//             });

//         } 
//         catch(error){
//             console.error(`Failed to handle file ${filename}:`, error);
//         }
//     });
// }

// module.exports = { setupFileWatcher };






const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs/promises');
const { Worker } = require('worker_threads');
const { performance } = require('perf_hooks');
const FileEntry = require('../models/fileEntry');

const NUM_WORKERS = 4; // Adjust based on CPU cores

async function processFileWithWorkers(filePath, fileEntry) {
    const startTime = performance.now();

    let totalProcessed = 0;
    let completedWorkers = 0;
    let failedWorkers = 0;

    console.log(`Processing ${fileEntry.filename} with ${NUM_WORKERS} workers`);

    const workers = [];

    for(let i=0; i<NUM_WORKERS; i++){
        const workerStartTime = performance.now();

        const worker = new Worker(path.join(__dirname, 'csvWorker.js'), {
            workerData: {
                filePath,
                fileId: fileEntry._id.toString(),
                workerIndex: i,
                numWorkers: NUM_WORKERS,
                mongoUri: process.env.MONGODB_URI
            }
        });

        workers.push(worker);

        worker.on('message', async (msg) => {
            if(msg.status === 'completed'){
                const workerEndTime = performance.now();
                const workerTime = ((workerEndTime - workerStartTime) / 1000).toFixed(2);
                console.log(`Worker ${i} finished in ${workerTime}s. Processed ${msg.totalProcessed} records.`);
                totalProcessed += msg.totalProcessed;
            } 
            else if(msg.status === 'error'){
                console.error(`Worker ${i} error: ${msg.error}`);
                failedWorkers++;
            }

            completedWorkers++;
            worker.terminate();

            if(completedWorkers === workers.length){
                const endTime = performance.now();
                const totalTime = ((endTime - startTime) / 1000).toFixed(2);
                console.log(`All workers finished. Total processed: ${totalProcessed}`);
                console.log(`Total processing time: ${totalTime} seconds`);

                try{
                    await FileEntry.findByIdAndUpdate(fileEntry._id, {
                        processed: failedWorkers === 0,
                        processedAt: new Date(),
                        recordCount: totalProcessed
                    });
                    await fs.unlink(filePath); // Delete file after processing
                    console.log(`File ${path.basename(filePath)} deleted at ${new Date().toLocaleTimeString()}`);
                } 
                catch(dbError){
                    console.error('Final update/delete failed:', dbError);
                }
            }
        });

        worker.on('error', (err) => {
            console.error(`Worker thread error: ${err.message}`);
            completedWorkers++;
            failedWorkers++;
        });
    }
}

function setupFileWatcher(folderPath) {
    const watcher = chokidar.watch(folderPath, {
        ignored: /^\./,
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('add', async (filePath) => {
        const resolvedPath = path.resolve(filePath);
        const filename = path.basename(resolvedPath);
        console.log(`New file detected: ${filename}`);

        try {
            const existingEntry = await FileEntry.findOne({filename});
            if(existingEntry){
                console.log(`File ${filename} already processed. Skipping.`);
                return;
            }

            const fileEntry = await FileEntry.create({
                filename,
                folderPath: path.dirname(resolvedPath)
            });
            console.log(`Created DB entry for ${filename}. Starting multithreaded processing.`);

            await processFileWithWorkers(resolvedPath, fileEntry);
        } 
        catch(error){
            console.error(`Failed to handle file ${filename}:`, error);
        }
    });
}

module.exports = { setupFileWatcher };
