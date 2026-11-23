# 紫金矿业跨境合规证据工作台

动态网站开发技术课程小组项目。仓库从 [上学期 Vue 项目](https://github.com/Lain006/zjjinkuangye/tree/06e241c) 迁移资料和业务口径，用 React、Node.js 和 PostgreSQL 实现公开检索、数据联动，以及管理端的来源采集、审核、发布和归档。

## 提交地址

| 交付 | 地址 |
| --- | --- |
| GitHub | [Lain006/zjjinkuangye-react](https://github.com/Lain006/zjjinkuangye-react) |
| 公网前端 | [紫金矿业跨境合规文献库](https://zjjinkuangye-react.onrender.com/) |
| 公网后端 | [文献查询 API](https://zjjinkuangye-react.onrender.com/api/v1/documents) |

答辩应用版本固定为 [v1.0.0](https://github.com/Lain006/zjjinkuangye-react/tree/v1.0.0)。

## 本地运行

需要 Node.js 24、npm 和一个 PostgreSQL 实例。安装 Docker 的机器可以用 `docker compose up -d db` 在本机启动独立数据库。

```powershell
npm ci
docker compose up -d db
$env:DATABASE_URL = 'postgresql://zj_course@127.0.0.1:55432/zj_course'
$env:ADMIN_PASSWORD = Read-Host '设置本地维护员口令（至少 12 字符）' -MaskInput
npm run migrate
npm run seed
npm run dev
```

访问 [本地 React](http://localhost:5173/)、[维护后台](http://localhost:5173/admin) 和 [本地 JSON API](http://localhost:3001/api/v1/documents)。已有本地 PostgreSQL 时，直接设置对应的 `DATABASE_URL`。生产构建使用 `npm run build` 和 `npm start`，首页与 Node API 同在 3001 端口。

```powershell
npm run typecheck
npm run lint
npm run build
$env:TEST_DATABASE_URL = 'postgresql://zj_course@127.0.0.1:55432/zj_course_test'
npm test
npx playwright install chromium
npm run test:e2e
```

集成测试使用独立 PostgreSQL 库内的临时 schema。端到端测试使用本地演示实例，并归档自己创建的测试资料。DBeaver 的数据库角色和答辩查询见部署说明。

## 项目文档

- [实现规格与旧能力迁移](docs/SPEC.md)
- [API 与数据库关系图](docs/API.md)
- [来源核验与种子数据](docs/SEED-AUDIT.md)
- [免费部署与只读演示](docs/DEPLOY.md)
- [答辩与个人报告材料](docs/DEMO.md)
- [开源项目与引用](docs/SOURCES.md)
- [验证记录](docs/VERIFICATION.md)
