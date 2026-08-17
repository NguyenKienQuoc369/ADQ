#!/bin/bash

# =================================================================
# Script cấu hình an toàn cho quoc_omni.py
# =================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  🔒 quoc_omni.py - Cấu hình An toàn${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Kiểm tra Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[!] Python3 chưa được cài đặt${NC}"
    exit 1
fi
echo -e "${GREEN}[✓] Python3 được cài đặt${NC}"

# Kiểm tra .gitignore
if [ ! -f .gitignore ]; then
    echo -e "${YELLOW}[!] File .gitignore chưa tồn tại, tạo mới...${NC}"
    cat > .gitignore << 'EOF'
.env
.env.local
recon_*/
*.pyc
__pycache__/
EOF
    echo -e "${GREEN}[✓] Đã tạo .gitignore${NC}"
else
    if grep -q "^\.env$" .gitignore; then
        echo -e "${GREEN}[✓] .env đã được ignore trong .gitignore${NC}"
    else
        echo -e "${YELLOW}[!] Thêm .env vào .gitignore...${NC}"
        echo ".env" >> .gitignore
        echo -e "${GREEN}[✓] Đã thêm .env vào .gitignore${NC}"
    fi
fi

# Kiểm tra .env.example
if [ ! -f .env.example ]; then
    echo -e "${YELLOW}[!] File .env.example chưa tồn tại${NC}"
    echo -e "${YELLOW}    Hãy chạy: git pull để lấy file${NC}"
else
    echo -e "${GREEN}[✓] File .env.example tồn tại${NC}"
fi

# Kiểm tra và tạo .env
if [ -f .env ]; then
    echo -e "${YELLOW}[!] File .env đã tồn tại${NC}"
    read -p "Bạn có muốn cập nhật .env không? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}[*] Bỏ qua cấu hình .env${NC}"
        SKIP_ENV=1
    fi
fi

# Hiển thị hướng dẫn tiếp theo
echo -e "\n${BLUE}═════ HOÀN TẤT CẤU HÌNH ═════${NC}"
echo -e "${GREEN}[✓] Cấu hình an toàn hoàn tất!${NC}\n"

echo -e "${BLUE}🚀 Để chạy script:${NC}"
echo -e "${YELLOW}$ python3 adq_cli.py${NC}\n"

echo -e "${BLUE}📚 Tài liệu thêm:${NC}"
echo -e "  ${YELLOW}SECURITY.md${NC}                # Hướng dẫn bảo mật chi tiết"
echo -e "  ${YELLOW}README.md${NC}                  # Hướng dẫn sử dụng\n"
