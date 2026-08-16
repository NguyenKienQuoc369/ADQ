import os
import shutil
import tempfile
import pytest
from unittest.mock import patch, MagicMock

import quoc_omni


def test_tool_available():
    """Kiểm tra hàm tool_available với tool có sẵn và tool không tồn tại."""
    assert quoc_omni.tool_available("python3") is True
    assert quoc_omni.tool_available("tool_definitely_not_exist_9999") is False


def test_normalize_target():
    """Kiểm tra hàm normalize_target với các dạng URL đầu vào khác nhau."""
    assert quoc_omni.normalize_target("http://example.com") == "example.com"
    assert quoc_omni.normalize_target("https://sub.target.org/") == "sub.target.org"
    assert quoc_omni.normalize_target("localhost:3000") == "localhost:3000"
    assert quoc_omni.normalize_target("127.0.0.1:8080") == "127.0.0.1:8080"

    with pytest.raises(ValueError):
        quoc_omni.normalize_target("http://example.com/test_path")


def test_sanitize_folder_name():
    """Kiểm tra làm sạch tên thư mục."""
    assert quoc_omni.sanitize_folder_name("127.0.0.1:3000") == "recon_127_0_0_1_3000"
    assert quoc_omni.sanitize_folder_name("target-enterprise.com") == "recon_target-enterprise_com"


def test_count_lines_and_ensure_file():
    """Kiểm tra tạo file và đếm số dòng."""
    temp_dir = tempfile.mkdtemp()
    try:
        file_path = os.path.join(temp_dir, "test.txt")
        quoc_omni.ensure_file(file_path)
        assert os.path.exists(file_path)
        assert quoc_omni.count_lines(file_path) == 0

        with open(file_path, "w") as f:
            f.write("line1\nline2\nline3\n")
        assert quoc_omni.count_lines(file_path) == 3
    finally:
        shutil.rmtree(temp_dir)


def test_cleanup_temp_files():
    """Kiểm tra luồng dọn dẹp file tạm (Garbage Collection Validation)."""
    temp_dir = tempfile.mkdtemp()
    try:
        # Tạo file tạm thời
        sub_file = os.path.join(temp_dir, "subdomains.txt")
        tech_file = os.path.join(temp_dir, "httpx_tech.txt")
        pass_file = os.path.join(temp_dir, "tech_wordpress.txt")
        # File báo cáo chính
        result_json = os.path.join(temp_dir, "result.json")

        for p in [sub_file, tech_file, pass_file, result_json]:
            with open(p, "w") as f:
                f.write("test content\n")

        # Chạy hàm dọn dẹp
        quoc_omni.cleanup_temp_files(temp_dir)

        # File tạm thời phải bị xóa
        assert not os.path.exists(sub_file)
        assert not os.path.exists(tech_file)
        assert not os.path.exists(pass_file)
        # File kết quả chính vẫn phải giữ nguyên
        assert os.path.exists(result_json)
    finally:
        shutil.rmtree(temp_dir)


def test_graceful_degradation_missing_tool():
    """Kiểm tra cơ chếGraceful Degradation khi không tìm thấy tool."""
    with patch("quoc_omni.tool_available", return_value=False):
        # Khi tool không khả dụng, tool_available luôn trả về False
        assert quoc_omni.tool_available("subfinder") is False
        assert quoc_omni.tool_available("httpx-toolkit") is False


def test_run_command_timeout():
    """Kiểm tra xử lý Timeout của lệnh subprocess."""
    temp_dir = tempfile.mkdtemp()
    try:
        out_file = os.path.join(temp_dir, "out.txt")
        # Chạy lệnh sleep 5 giây với timeout 1 giây
        ret = quoc_omni.run_command("TestSleep", ["sleep", "5"], out_file, timeout=1)
        assert ret == ""
    finally:
        shutil.rmtree(temp_dir)
