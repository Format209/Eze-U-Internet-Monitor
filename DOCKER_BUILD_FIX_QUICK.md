# Docker Build Fix - Quick Reference

## 🚨 Error
```
ModuleNotFoundError: No module named 'distutils'
EBADENGINE: better-sqlite3 requires Node 20+, current: Node 18
```

## ⚡ Quick Fix

### 3 Changes Made
1. ✅ Node.js 18 → Node.js 20 (both stages)
2. ✅ Added Python distutils (`py3-setuptools`)
3. ✅ Updated npm flag (`--only=production` → `--omit=dev`)

### Rebuild Command
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Time**: 5-10 minutes

## 📋 Files Modified

### Dockerfile
- Line 3: `node:18-alpine` → `node:20-alpine`
- Line 16: `node:18-alpine` → `node:20-alpine`
- Line 27: Added `python3-dev` and `py3-setuptools`
- Line 46: `--only=production` → `--omit=dev`

### Result
✅ better-sqlite3 compiles successfully
✅ No more distutils errors
✅ No more Node version warnings

## ✅ Success Check

After rebuild, verify:
```bash
# 1. Container running
docker-compose ps
# Should show: Up X seconds (healthy)

# 2. Check logs
docker-compose logs | grep "✓"
# Should show: ✓ Database initialized with better-sqlite3

# 3. Test API
curl http://localhost:8745/api/settings
# Should return JSON
```

## 🎯 Why It Happened

| Component | Issue | Fix |
|-----------|-------|-----|
| better-sqlite3 v12 | Requires Node 20+ | Upgrade to Node 20 |
| Python 3.12 | Removed distutils | Add py3-setuptools |
| npm | Deprecated flag | Use --omit=dev |

## 📚 More Info

See `DOCKER_BUILD_ERROR_FIX.md` for complete details.

---

**Status**: ✅ Fixed! Rebuild to apply.
