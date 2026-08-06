from fastapi.testclient import TestClient
import pytest

from target_mock import app


@pytest.fixture
def client():
    return TestClient(app)


def test_waf_force429(client):
    r = client.get('/waf?mode=force429')
    assert r.status_code == 429
    assert 'Too Many Requests' in r.json().get('detail')


def test_waf_ok(client):
    r = client.get('/waf?mode=ok')
    assert r.status_code == 200
    assert r.json().get('status') == 'ok'


def test_param_fail(client):
    r = client.get('/param?state=fail')
    assert r.status_code == 500


def test_param_ok(client):
    r = client.get('/param?state=ok')
    assert r.status_code == 200
    j = r.json()
    assert j['result'] == 'received' and j['state'] == 'ok'


def test_auth_refresh_success(client):
    r = client.post('/auth/refresh', json={'refresh_token': 'valid_refresh'})
    assert r.status_code == 200
    j = r.json()
    assert 'access_token' in j and j['access_token'].startswith('new_access_token')


def test_auth_refresh_fail(client):
    r = client.post('/auth/refresh', json={'refresh_token': 'bad'})
    assert r.status_code == 401
