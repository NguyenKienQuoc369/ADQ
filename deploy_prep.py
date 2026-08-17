import os
import sys


def main():
    print("=" * 60)
    print("ADQ SECURITY PLATFORM - DEPLOY PREPARATION & SMOKE TEST")
    print("=" * 60)

    # 1. Smoke Test: Import all backend modules to verify no Circular Imports
    print("\n[1/3] Testing Backend Module Imports for Circular Dependencies...")
    sys.path.insert(0, os.path.abspath("."))

    modules_to_test = [
        "backend.core.config",
        "backend.core.db",
        "backend.core.auth",
        "backend.schemas.scan",
        "backend.schemas.project",
        "backend.schemas.admin",
        "backend.services.scan_service",
        "backend.services.project_service",
        "backend.services.admin_service",
        "backend.routers.scan_router",
        "backend.routers.project_router",
        "backend.routers.admin_router",
        "backend.api_server",
    ]

    for mod in modules_to_test:
        try:
            __import__(mod)
            print(f"  ✓ Imported: {mod}")
        except Exception as exc:
            print(f"  ❌ FAILED to import '{mod}': {exc}")
            sys.exit(1)

    # 2. Dọn rác Server: Remove dummy / mock test files if present
    print("\n[2/3] Cleaning up server dummy / mock files...")
    dummy_files = [
        "backend/tests/dummy_api.py",
        "backend/tests/mock_data.py",
    ]
    for file_path in dummy_files:
        full_path = os.path.abspath(file_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                print(f"  ✓ Removed dummy file: {file_path}")
            except Exception as e:
                print(f"  ⚠️ Could not remove {file_path}: {e}")
        else:
            print(f"  - File not found (already clean): {file_path}")

    # 3. Tự hủy: Self-destruct script
    print("\n[3/3] Self-destructing deploy_prep.py...")
    self_path = os.path.abspath(__file__)
    try:
        os.remove(self_path)
        print("  ✓ deploy_prep.py removed successfully!")
    except Exception as e:
        print(f"  ⚠️ Self-destruct warning: {e}")

    print("\n" + "=" * 60)
    print("DEPLOYMENT PREPARATION COMPLETE - SYSTEM READY FOR VPS DEPLOYMENT")
    print("=" * 60)


if __name__ == "__main__":
    main()
