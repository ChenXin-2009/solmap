// 简单测试脚本，验证相机配置是否正确读取
const { QUICK_CAMERA_SETTINGS } = require('./src/lib/config/cameraConfig.ts');

console.log('相机配置测试:');
console.log('largeZoomMaxSpeed:', QUICK_CAMERA_SETTINGS.largeZoomMaxSpeed);
console.log('smallZoomMaxSpeed:', QUICK_CAMERA_SETTINGS.smallZoomMaxSpeed);
console.log('zoomEasingSpeed:', QUICK_CAMERA_SETTINGS.zoomEasingSpeed);
console.log('zoomBaseFactor:', QUICK_CAMERA_SETTINGS.zoomBaseFactor);

console.log('\n配置读取成功！现在修改 cameraConfig.ts 中的参数应该会生效。');