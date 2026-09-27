import {cp, mkdir, readFile, rm, writeFile, access} from "node:fs/promises";
import path from "node:path";
import {build} from "esbuild";

const root=process.cwd();
const out=path.join(root,"www");
const pkg=JSON.parse(await readFile(path.join(root,"package.json"),"utf8"));
const webVersion=process.env.MOBILE_WEB_VERSION||pkg.version;
const nativeVersion=process.env.NATIVE_VERSION||pkg.version;
const commit=process.env.GITHUB_SHA||process.env.COMMIT_SHA||"local";

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const entry of ["index.html","app.js","styles.css","data"]){
  await cp(path.join(root,entry),path.join(out,entry),{recursive:true});
}
for(const optional of ["assets","icons","manifest.webmanifest","sw.js"]){
  try{
    await access(path.join(root,optional));
    await cp(path.join(root,optional),path.join(out,optional),{recursive:true});
  }catch{}
}

const indexPath=path.join(out,"index.html");
let html=await readFile(indexPath,"utf8");
const appScript=/<script type="module" src="\.\/app\.js[^"]*"><\/script>/;
if(!appScript.test(html))throw new Error("Could not find the app.js module script in index.html");
html=html.replace(appScript,match=>`<script type="module" src="./mobile-runtime.js"></script>\n  ${match}`);
await writeFile(indexPath,html);

await build({
  entryPoints:[path.join(root,"mobile","entry.js")],
  outfile:path.join(out,"mobile-runtime.js"),
  bundle:true,
  minify:true,
  format:"esm",
  platform:"browser",
  target:["chrome120"],
  sourcemap:false,
  legalComments:"none"
});

await writeFile(path.join(out,"mobile-build.json"),JSON.stringify({
  webVersion,
  nativeVersion,
  commit,
  builtAt:new Date().toISOString()
},null,2)+"\n");

console.log(`Mobile web bundle ready: www/ (web ${webVersion}, native ${nativeVersion})`);
