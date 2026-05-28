// UPnP/DLNA 推流服务 - 发现局域网设备，推送音频

import { loadConfig } from '../config.js';

let discoveredDevices = [];

export async function discoverDevices() {
  // UPnP发现需要 node-ssdp，标记为可选功能
  // 基础实现：返回空列表
  try {
    const { Client } = await import('node-ssdp');
    const client = new Client();

    return new Promise((resolve) => {
      const devices = [];
      const timeout = setTimeout(() => {
        client.stop();
        discoveredDevices = devices;
        resolve(devices);
      }, 5000);

      client.on('response', (headers) => {
        const location = headers.LOCATION;
        if (location && !devices.find(d => d.location === location)) {
          devices.push({
            location,
            usn: headers.USN,
            name: parseDeviceName(headers)
          });
        }
      });

      client.search('ssdp:all');
    });
  } catch {
    return [];
  }
}

function parseDeviceName(headers) {
  // 简化：从USN中提取设备信息
  return headers.USN?.split('::')[0] || 'Unknown Device';
}

export function getDiscoveredDevices() {
  return discoveredDevices;
}

export async function streamToDevice(deviceIndex, audioUrl) {
  // 实际推流需要 UPnP AV Transport 控制
  // 此处为占位实现
  console.log(`Streaming ${audioUrl} to device ${deviceIndex}`);
  return { success: false, message: 'UPnP推流功能开发中' };
}
