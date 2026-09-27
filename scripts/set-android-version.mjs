import {readFile,writeFile} from "node:fs/promises";

const versionName=process.argv[2];
const versionCode=Number(process.argv[3]);
if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName||""))throw new Error("versionName must be semver, e.g. 1.0.0");
if(!Number.isSafeInteger(versionCode)||versionCode<1)throw new Error("versionCode must be a positive integer");

const file="android/app/build.gradle";
let source=await readFile(file,"utf8");
let codeCount=0,nameCount=0;
source=source.replace(/versionCode\s*(?:=\s*)?\d+/g,()=>{codeCount++;return `versionCode = ${versionCode}`;});
source=source.replace(/versionName\s*(?:=\s*)?["'][^"']+["']/g,()=>{nameCount++;return `versionName = "${versionName}"`;});
if(codeCount!==1||nameCount!==1)throw new Error(`Expected one versionCode/versionName in ${file}; found ${codeCount}/${nameCount}`);
await writeFile(file,source);
console.log(`Android version set to ${versionName} (${versionCode})`);
