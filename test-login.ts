import axios from 'axios';

async function test() {
  try {
    const res = await axios.post('http://localhost:3000/api/v1/auth/login', {
      email: 'admin@erp.com',
      password: 'admin123'
    });
    console.log(res.data);
  } catch (e: any) {
    console.log(e.response?.data || e.message);
  }
}

test();
