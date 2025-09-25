const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs/promises');
const {fork} = require('child_process');
const FileEntry = require('../models/fileEntry');

function setupFileWatcher(folderPath) {
    const watcher = chokidar.watch(folderPath, {
        ignored: /^\./,       // ignore dotfiles
        persistent: true,
        ignoreInitial: true,  // ignore existing files at startup
    });

    watcher.on('add', async (filePath) => {
        const resolvedPath = path.resolve(filePath);
        const filename = path.basename(resolvedPath);
        console.log(`New file detected: ${filename}`);

        try{
            const existingEntry = await FileEntry.findOne({filename});
            if(existingEntry){
                console.log(`File ${filename} already processed. Skipping.`);
                return;
            }

            const fileEntry = await FileEntry.create({
                filename,
                folderPath: path.dirname(resolvedPath)
            });
            console.log(`Created DB entry for ${filename}.`);

            const child = fork(path.join(__dirname, 'csvWorker.js'));
            child.send({filePath: resolvedPath, fileId: fileEntry._id});

            child.on('message', async (message) => {
                if(message.status === 'completed'){
                    console.log(`Processing of ${filename} completed. Inserted: ${message.totalInserted}`);
                    await FileEntry.findByIdAndUpdate(message.fileId, {
                        processed: true,
                        processedAt: new Date(),
                        recordCount: message.totalInserted
                    });
                    await fs.unlink(resolvedPath);
                    console.log(`File ${filename} deleted.`);
                    child.kill();
                } 
                else if(message.status === 'error'){
                    console.error(`Error processing ${filename}: ${message.error}`);
                    await FileEntry.findByIdAndUpdate(message.fileId, {errorLog: message.error});
                    child.kill();
                }
            });

            child.on('error', (err) => {
                console.error(`Child process error for ${filename}:`, err);
            });

            child.on('exit', (code, signal) => {
                if(code !== 0) console.warn(`Child process exited with code ${code} (${signal})`);
            });

        } 
        catch(error){
            console.error(`Failed to handle file ${filename}:`, error);
        }
    });
}

module.exports = { setupFileWatcher };
