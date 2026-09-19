import {buildChunk} from './osaka-mesh.js';
self.onmessage=({data:{id,data}})=>{try{const start=performance.now(),meshes=buildChunk(data),transfer=[];for(const key of ['near','far','ground','detail'])for(const arr of Object.values(meshes[key]))transfer.push(arr.buffer);self.postMessage({id,meshes,buildMs:performance.now()-start},transfer);}catch(e){self.postMessage({id,error:String(e)});}};
