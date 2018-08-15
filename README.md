# snek-node
Typescript node-fetch wrapper with an snekfetch like interface

## Example Usage:

```ts
import { Request: { get, post } } from 'snek-node';,

get('https://google.com')
	.then(res => console.log(res.body))
	.catch(console.error)

post('https://google.com')
	.set('Authorization', 'Token')
	.send({ data: 'important data'})
	.query('site', '1')
	.then(res => console.log(res.body))
	.catch(console.error)
```

```js
const { Request: { get, post }} = require('snek-node');

get('https://google.com')
	.then(res => console.log(res.body))
	.catch(console.error)

post('https://google.com')
	.set('Authorization', 'Token')
	.send({ data: 'important data'})
	.query('site', '1')
	.then(res => console.log(res.body))
	.catch(console.error)
```