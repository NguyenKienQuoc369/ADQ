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

if [ -z "$SKIP_ENV" ]; then
    echo -e "\n${BLUE}═════ CẤU HÌNH TELEGRAM ═════${NC}"
    
    echo -e "${YELLOW}[?] Nhập Telegram Bot Token:${NC}"
    echo -e "    (Lấy từ BotFather: @BotFather trên Telegram)"
    read -p "    Token: " TELEGRAM_TOKEN
    
    if [ -z "$TELEGRAM_TOKEN" ]; then
        echo -e "${RED}[!] Token không được để trống${NC}"
        exit 1
    fi
    
    echo -e "\n${YELLOW}[?] Nhập Telegram Chat ID:${NC}"
    echo -e "    (Nhắn tin cho bot, rồi: https://api.telegram.org/bot<TOKEN>/getUpdates)"
    read -p "    Chat ID: " TELEGRAM_CHAT_ID
    
    if [ -z "$TELEGRAM_CHAT_ID" ]; then
        echo -e "${RED}[!] Chat ID không được để trống${NC}"
        exit 1
    fi
    
    # Tạo file .env
    cat > .env << EOF
# =================================================================
# Cấu hình Telegram Notifications
# =================================================================
# ⚠️  CẢNH BÁO: Tuyệt đối KHÔNG commit file này lên Git!
# Được thêm vào .gitignore

export TELEGRAM_TOKEN="$TELEGRAM_TOKEN"
export TELEGRAM_CHAT_ID="$TELEGRAM_CHAT_ID"

# Đường dẫn wordlist (tùy chọn)
# export WORDLIST_PATH=/usr/share/seclists/Discovery/Web-Content/common.txt
EOF
    
    chmod 600 .env  # Chỉ chủ sở hữu có thể đọc
    echo -e "${GREEN}[✓] Đã tạo file .env${NC}"
    echo -e "${YELLOW}[!] Phân quyền: chmod 600 .env (chỉ chủ sở hữu có thể đọc)${NC}"
fi

# Kiểm tra Git history
echo -e "\n${BLUE}═════ KIỂM TRA GIT HISTORY ═════${NC}"

if [ -d .git ]; then
    echo -e "${YELLOW}[*] Kiểm tra xem có token nào trong Git history...${NC}"
    
    if git log -p --all -S "TELEGRAM_TOKEN" 2>/dev/null | grep -q TELEGRAM_TOKEN; then
        echo -e "${RED}[!] ⚠️  CẢNH BÁO: Tìm thấy TELEGRAM_TOKEN trong Git history!${NC}"
        echo -e "    ${YELLOW}Cần xóa bằng:${NC}"
        echo -e "    ${YELLOW}$ git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all${NC}"
        echo -e "    ${YELLOW}$ git push origin --force --all${NC}"
    else
        echo -e "${GREEN}[✓] Git history an toàn${NC}"
    fi
    
    echo -e "${GREEN}[✓] Đã loại bỏ .env khỏi Git tracking${NC}"
    git rm --cached .env 2>/dev/null || true
else
    echo -e "${YELLOW}[*] Không phải Git repo${NC}"
fi

# Test credentials
echo -e "\n${BLUE}═════ TEST CREDENTIALS ═════${NC}"

if [ -f .env ]; then
    source .env
    
    if [ -z "$TELEGRAM_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        echo -e "${RED}[!] Credentials chưa được thiết lập${NC}"
        echo -e "    ${YELLOW}Chạy: source .env${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}[*] Gửi tin nhắn test đến Telegram...${NC}"
    
    TEST_MESSAGE="✅ quoc_omni.py đã được cấu hình thành công!"
    RESPONSE=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        -d "{\"chat_id\": \"$TELEGRAM_CHAT_ID\", \"text\": \"$TEST_MESSAGE\"}" \
        "https://api.telegram.org/bot$TELEGRAM_TOKEN/sendMessage")
    
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        echo -e "${GREEN}[✓] Tin nhắn test đã gửi thành công!${NC}"
    else
        echo -e "${RED}[!] Không thể gửi tin nhắn${NC}"
        echo -e "    ${YELLOW}Response:${NC}"
        echo "    $RESPONSE"
        exit 1
    fi
else
    echo -e "${YELLOW}[*] Bỏ qua test (chưa cấu hình .env)${NC}"
fi

# Hiển thị hướng dẫn tiếp theo
echo -e "\n${BLUE}═════ HOÀN TẤT CẤU HÌNH ═════${NC}"
echo -e "${GREEN}[✓] Cấu hình an toàn hoàn tất!${NC}\n"

echo -e "${BLUE}🚀 Để chạy script:${NC}"
echo -e "${YELLOW}$ source .env${NC}"
echo -e "${YELLOW}$ python3 quoc_omni.py target.com --ctf-mode${NC}\n"

echo -e "${BLUE}📋 Các tùy chọn:${NC}"
echo -e "  ${YELLOW}--ctf-mode${NC}                  # Tối ưu cho CTF"
echo -e "  ${YELLOW}--nuclei-auto-tags${NC}         # Tự chọn nuclei tags"
echo -e "  ${YELLOW}--nuclei-ctf-pack${NC}          # Thêm CTF tags"
echo -e "  ${YELLOW}--nuclei-two-pass${NC}          # Chạy 2 lượt Nuclei"
echo -e "  ${YELLOW}--no-telegram${NC}              # Tắt Telegram"
echo -e "  ${YELLOW}--help${NC}                     # Xem tất cả tùy chọn\n"

echo -e "${BLUE}📚 Tài liệu thêm:${NC}"
echo -e "  ${YELLOW}SECURITY.md${NC}                # Hướng dẫn bảo mật chi tiết"
echo -e "  ${YELLOW}README.md${NC}                  # Hướng dẫn sử dụng\n"
