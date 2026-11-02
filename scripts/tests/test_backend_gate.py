import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from check_backend import check_backend


class GateTests(unittest.TestCase):
    def responses(self,health):
        values=[health,{'token':'test-only-token'},{'role':'guest','user':None,'isAdmin':False,'canEdit':False},{'items':[]},{'items':[]}]
        return [io.BytesIO(json.dumps({'success':True,'data':value}).encode()) for value in values]

    def test_ready_contract_and_guest_read_only(self):
        with patch('urllib.request.urlopen',side_effect=self.responses({'status':'ready','apiVersion':1,'commit':'a'*40})) as fetch:
            check_backend()
            self.assertEqual(fetch.call_count,5)
            self.assertEqual(fetch.call_args_list[2].args[0].get_header('Authorization'),'Bearer test-only-token')

    def test_incompatible_backend_stops_before_guest_or_publish(self):
        with patch('urllib.request.urlopen',side_effect=self.responses({'status':'ready','apiVersion':2,'commit':'a'*40})) as fetch:
            with self.assertRaises(RuntimeError):check_backend()
            self.assertEqual(fetch.call_count,1)
