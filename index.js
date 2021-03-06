#!/usr/bin/env node

//To eliminate hard coding paths for require, we are modifying the NODE_PATH to include
//out lib folder
var oldpath = '';
if (process.env['NODE_PATH']!==undefined){
  oldpath = process.env['NODE_PATH'];
}

//just in case already been set leave it alone
process.env['NODE_PATH']=__dirname+'/modules:'+oldpath;
require('module').Module._initPaths();

var program=require("commander");

var _device;
program
  .arguments('<device>')
  .usage('[options <device>]')
  .option('-r, --resolution <resolution>', 'Video resolution (default: 1920x1080)','1920x1080')
  .option('-f, --framerate <framerate>',' Video framerate (default: 30)',parseInt,30)
  .option('-p, --port <port>','Webserver http port (default:8090)',parseInt,8090)
  .option('-l, --location <location>' , 'Camera mounted location (default: forward)','forward')
  .option('-u, --url <url>','A URL relative to the the server that the camera feed can be access','/rov/forward-camera')
  .option('-m, --mock <mock>','Run a fake camera feed',false)
  .action(function(device){
    _device = device;
   })
  .parse(process.argv);

var validator = require('validateOptions');

var options=program;
options.device = _device;
if (options.device == undefined){
  options.device = '/dev/video0';
}

var launch_options = ['mjpg_streamer',
    '-i',
    '/usr/local/lib/input_uvc.so -r ' + options.resolution + ' -f ' + options.framerate + ' -d ' + options.device,
    '-o',
    '/usr/local/lib/output_http.so -p ' + options.port
  ];

if (options.mock){
  launch_options[0]=require.resolve('mock-video-server.js');
}
var respawn = require('respawn')

const infinite=-1;
var monitor = respawn(launch_options,{
  name: 'mjpeg',
  maxRestarts: infinite,
  sleep: 1000
});

var beacon_timer = null;
monitor.on('spawn',function(){
  var announcement = {service:'mjpeg-video',port:options.port,addresses:['127.0.0.1'],txtRecord:{resolution: options.resolution, framerate: options.framerate, videoMimeType: 'video/x-motion-jpeg', cameraLocation: options.location, relativeServiceUrl:options.url}};
  var jannouncement =  JSON.stringify(announcement);
  console.error(jannouncement);
  if (beacon_timer !== null){
    clearInterval(beacon_timer);
  }
  beacon_timer=setInterval(function(){
      console.error(jannouncement);
  },5000);
});

monitor.on('stop',function(){
});

monitor.on('stderr',function(data){
  if (data===undefined) return;
  console.error(data.toString('utf-8'));
});

validator(program,function(err){
  if (options.mock){
    monitor.start();
    return;
  }
  if (err) {
     console.log("Options error: " + err);
     process.exit(1);
  } else {
     var camera=require('camera.js');
     camera.MJPGCameraFound(options.device,function(){
       monitor.start();

     });
  }
});
