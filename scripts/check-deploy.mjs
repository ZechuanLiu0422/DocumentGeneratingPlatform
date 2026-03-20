#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const migrationPath = path.join(rootDir, 'supabase', 'migrations', '20260320120000_initial_schema.sql');

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const optionalProviders = [
  ['CLAUDE_API_KEY', 'CLAUDE_MODEL'],
  ['OPENAI_API_KEY', 'OPENAI_MODEL'],
  ['DOUBAO_API_KEY', 'DOUBAO_MODEL'],
  ['GLM_API_KEY', 'GLM_MODEL'],
];

function parseEnv(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith('#'))
    .reduce((result, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) {
        return result;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      result[key] = value;
      return result;
    }, {});
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

const issues = [];
const warnings = [];

if (!fs.existsSync(envPath)) {
  issues.push('未找到 .env 文件，请先根据 .env.example 创建并填写环境变量。');
}

let env = {};
if (fs.existsSync(envPath)) {
  env = parseEnv(fs.readFileSync(envPath, 'utf8'));
}

for (const key of requiredEnv) {
  if (!env[key]) {
    issues.push(`缺少必填环境变量: ${key}`);
  }
}

const enabledProviders = optionalProviders.filter(([apiKey, model]) => env[apiKey] && env[model]);
if (enabledProviders.length === 0) {
  issues.push('至少需要配置一组平台 AI 提供商密钥与模型。');
}

if (!env.SUPABASE_SERVICE_ROLE_KEY) {
  warnings.push('未配置 SUPABASE_SERVICE_ROLE_KEY。管理员邀请脚本无法使用，但应用运行本身不受影响。');
}

if (!fs.existsSync(migrationPath)) {
  issues.push('缺少 Supabase migration 文件，无法初始化数据库。');
}

printSection('环境变量');
if (Object.keys(env).length === 0) {
  console.log('未检测到可读取的 .env 配置');
} else {
  console.log(`已读取 .env，检测到 ${Object.keys(env).length} 个变量。`);
}

printSection('AI Provider');
if (enabledProviders.length > 0) {
  enabledProviders.forEach(([apiKey, model]) => {
    console.log(`已启用: ${apiKey} + ${model}`);
  });
} else {
  console.log('未检测到可用的 AI provider 组合');
}

printSection('Supabase');
console.log(fs.existsSync(migrationPath) ? '已检测到 migration 文件。' : '未检测到 migration 文件。');

if (warnings.length > 0) {
  printSection('Warnings');
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (issues.length > 0) {
  printSection('Failed Checks');
  issues.forEach((issue) => console.log(`- ${issue}`));
  process.exitCode = 1;
} else {
  printSection('Success');
  console.log('部署前本地检查通过。接下来请确认：');
  console.log('- Supabase 已执行 migration');
  console.log('- Supabase Auth 已创建或邀请首批用户');
  console.log('- Vercel Preview / Production 环境变量已分别配置');
}
