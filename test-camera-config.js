// 简单测试脚本，验证相机配置是否正确读取
const { QUICK_CAMERA_SETTINGS } = require('./src/lib/config/cameraConfig.ts');

console.log('相机配置测试:');
console.log('zoomEasingSpeed:', QUICK_CAMERA_SETTINGS.zoomEasingSpeed);
console.log('zoomBaseFactor:', QUICK_CAMERA_SETTINGS.zoomBaseFactor);
console.log('dampingFactor:', QUICK_CAMERA_SETTINGS.dampingFactor);
console.log('focusLerpSpeed:', QUICK_CAMERA_SETTINGS.focusLerpSpeed);
console.log('trackingLerpSpeed:', QUICK_CAMERA_SETTINGS.trackingLerpSpeed);

console.log('\n配置读取成功！现在修改 cameraConfig.ts 中的参数应该会生效。');