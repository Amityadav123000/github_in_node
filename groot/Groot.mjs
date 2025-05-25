import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto';
import {diffLines} from 'diff';
import chalk from 'chalk';
class Groot{
    constructor(repoPath='.'){
        this.repoPath=path.join(repoPath,'.groot');
        this.objectsPath=path.join(this.repoPath,'objects'); // .groot/objects
        this.headPath=path.join(this.repoPath,'HEAD'); // .groot/HEAD
        this.indexPath=path.join(this.repoPath,'index'); // .groot/index
        this.init();
    }

    async init(){
        await fs.mkdir(this.objectsPath,{recursive:true});
        try{        
            await fs.writeFile(this.headPath,'',{flag:'wx'});
            await fs.writeFile(this.indexPath,JSON.stringify([]),{flag:'wx'});
        }catch (error){
            console.log("Groot folder already init")
        }
    }

    hashObject(content){
        return crypto.createHash('sha1').update(content,'utf-8').digest('hex');
    }

    async add(fileToBeAdded){
        //file to be added: path:to file to be added
        const fileData = await fs.readFile(fileToBeAdded,{encoding:'utf-8'}); //read file
        const fileHash= this.hashObject(fileData); // hash file
        console.log(fileHash);
        const newFileHashedobjectPath=path.join(this.objectsPath,fileHash); 
        await fs.writeFile(newFileHashedobjectPath,fileData);
        //we have to add file to staging area in index
        await this.updateStagingArea(fileToBeAdded,fileHash)
        console.log(`Added ${fileToBeAdded}`);
    }

    async updateStagingArea(filePath,fileHash){
        const index = JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'})); // read the index file
        index.push(
        {path:filePath,
         hash:fileHash   
        });
        await fs.writeFile(this.indexPath,JSON.stringify(index));
    }

    async commit(message){
        const index=JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));
        const parentCommit = await this.getCurrentHead();
        const commitData = {
            timeStamp:new Date().toISOString(),
            message,
            files:index,
            parent:parentCommit
        };
        
        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath= path.join(this.objectsPath,commitHash);
        await fs.writeFile(commitPath,JSON.stringify(commitData));
        await fs.writeFile(this.headPath,commitHash);
        await fs.writeFile(this.indexPath,JSON.stringify([]));
        console.log(`Commit successfully created : ${commitHash}`);
    }
    async getCurrentHead(){
        try {
            return await fs.readFile(this.headPath,{encoding:'utf-8'});
        } catch (error) {
            return null;
        }
    }

    async log(){
        let currentCommitHash = await this.getCurrentHead();
        while(currentCommitHash){
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath,currentCommitHash),{encoding:'utf-8'}));
            console.log(`-----------------------`)
            console.log(`Commit: ${currentCommitHash}\nDate:${commitData.timeStamp}\n${commitData.message}\n\n`);
            currentCommitHash=commitData.parent;
        }
    }

    //facing issue in this part of code

    async showCommitDiff(commitHash){
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if(!commitData){
            console.log("commit not found");
            return;
        }
        console.log("Changes in last commit are:");

        for(const file of commitData.files){
            console.log(`file: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent);

            if(commitData.parent){
                const parentCommitData=JSON.parse(await this.getCommitData(commitData.parent));
                const getparentFileContent = await this.getparentFileContent(parentCommitData,file.path);

                if(getparentFileContent!== undefined){
                    console.log('\nDiff:\n');
                    const diff = diffLines(getparentFileContent,fileContent);

                    console.log(diff);

                    diff.forEach(part => {
                        if(part.added){
                            process.stdout.write(chalk.green(part.value));
                        }else if(part.removed){
                            process.stdout.write(chalk.red(part.value));
                        }else{
                            process.stdout.write(chalk.grey(part.value));
                        }
                    });
                    console.log();
                }else{
                    console.log("New file in this commit");
                }

            }else{
                console.log("First Commit")
            }
        }
    }

    async getparentFileContent(parentCommitData,filePath){
        const parentFile = parentCommitData.files.find(file=>file.path === filePath);
        if(parentFile){
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commitHash){
        const commitPath=path.join(this.objectsPath,commitHash);
        try {
            return await fs.readFile(commitPath,{encoding:'utf-8'});
        } catch (error) {
            console.log("failed to read commit data",error);
            return null;
        }
    }

    async getFileContent(fileHash){
        const objectPath=path.join(this.filePath,fileHash);
        return fs.readFile(objectPath,{encoding:'utf-8'});
    }



}

(async ()=>{
const groot=new Groot();
await groot.add('sample.txt');
await groot.commit('third commit')
await groot.log();
await groot.showCommitDiff("31d82e7f8526431bde1792cc7e987127037295fb");
})();
