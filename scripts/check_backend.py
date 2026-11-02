"""Read-only deployment gate; never writes business data or logs tokens."""
import json
import re
import urllib.request


def check_backend(origin='https://xuxiaoapi.online'):
    def request(path, token=None, body=None):
        headers={'Cache-Control':'no-cache'}
        if token:headers['Authorization']='Bearer '+token
        if body is not None:headers['Content-Type']='application/json'
        req=urllib.request.Request(origin+'/api/mianjing'+path,headers=headers,data=None if body is None else json.dumps(body).encode())
        with urllib.request.urlopen(req,timeout=15) as response:
            result=json.load(response)
            if result.get('success') is not True:raise RuntimeError('Backend returned failure')
            return result['data']
    health=request('/health')
    if health.get('status')!='ready' or health.get('apiVersion')!=1 or not re.fullmatch('[a-f0-9]{40}',health.get('commit','')):raise RuntimeError('Required mianjing API is not ready')
    token=request('/auth/guest',body={})['token']
    if request('/me',token)!={'role':'guest','user':None,'isAdmin':False,'canEdit':False}:raise RuntimeError('Guest permissions incorrect')
    request('/questions',token)
    request('/company-catalog',token)
    print('Backend contract and guest access ready; backend commit '+health['commit'])


if __name__=='__main__':
    check_backend()
