import fetch, { Response } from 'node-fetch';
import { stringify, parse } from 'querystring';

export const { version } = require('../package.json');

export type StringObject = {
	[key: string]: string
};

export type RequestOptions = {
	method?: string,
	headers?: StringObject,
	query?: StringObject,
	body?: any,
	userAgent?: string
};

export type Options = {
	url: string,
	method: string,
	headers: StringObject,
	query?: StringObject,
	body?: any,
	userAgent: string
};

export interface Result {
	body: object | string | Buffer;
	raw: string;
	ok: boolean;
	statusCode: number;
	statusText: string;
	headers: StringObject;
}

export class HTTPError extends Error implements Result {
	body: object | string | Buffer;
	raw: string;
	ok: boolean;
	statusCode: number;
	statusText: string;
	headers: StringObject;

	constructor (message: string, res: Result) {
		super(message);
		this.body = res.body;
		this.raw = res.raw;
		this.ok = res.ok;
		this.statusCode = res.statusCode;
		this.statusText = res.statusText;
		this.headers = res.headers;
		this.name = this.constructor.name;
	}
}

export class Request {
	private _options: Options;
	private _response?: any;

	static get(url: string, options?: RequestOptions) {
		return new Request('GET', url, options);
	}

	static post(url: string, options?: RequestOptions) {
		return new Request('POST', url, options);
	}

	static patch(url: string, options?: RequestOptions) {
		return new Request('PATCH', url, options);
	}

	static delete(url: string, options?: RequestOptions) {
		return new Request('DELETE', url, options);
	}

	constructor(method: string, url: string, options: RequestOptions = {} ) {
		this._options = Object.assign({
			method,
			url,
			headers: {},
			query: undefined,
			data: undefined
		});
		if (options.headers) {
			this.set(options.headers);
		}
		if (options.body) {
			this.send(options.body);
		}
		this._options.userAgent = options.userAgent || 'snek-node';
	}

	query (name: object | string, value?: string) {
		if (this._options.query === undefined) {
			this._options.query = {};
		}
		if (typeof name === 'object') {
			Object.assign(this._options.query, name);
		} else if (value) {
			this._options.query[name] = value;
		}
		return this;
	}

	set (name: object | string, value?: string) {
		if (typeof name === 'object') {
			for (const [k, v] of Object.entries(name)) {
				this._options.headers[k.toLowerCase()] = v;
			}
		} else if (value) {
			this._options.headers[name.toLowerCase()] = value;
		}
		return this;
	}

	send (data: any): this {
		if (data !== null && typeof data === 'object') {
			const header = this._options.headers['content-type'];
			let serialize: (value: any) => string;
			if (header) {
				if (header.includes('application/json')) {
					serialize = JSON.stringify;
				} else if (header.includes('urlencoded')) {
					serialize = stringify;
				} else {
					return this._options.body = data;
				}
			} else {
				this.set('Content-Type', 'application/json');
				serialize = JSON.stringify;
			}
			this._options.body = serialize(data);
		} else {
			this._options.body = data;
		}
		return this;
	}

	then(resolver?: (result: Result) => void, rejector?: (error: HTTPError) => void): Promise<void> {
		if (this._response) {
			this._response = this._response.then(resolver, rejector);
		} else {
			this._response = this.execute().then(resolver, rejector);
		}
		return this._response;
	}

	catch(rejector: (error: HTTPError) => void) {
		return this.then(undefined, rejector);
	}

	private async execute(): Promise<Result> {
			if (this._options.query) {
				let index = 0;
				for (const key of Object.keys(this._options.query)) {
					this._options.url += `${!index ? '?' : '&'}${key}=${this._options.query[key]}`;
					index++;
				}
			}
			if (!this._options.headers['user-agent']) this.set('user-agent', this._options.userAgent);
			try {
				const res = await fetch(this._options.url, { body: this._options.body, method: this._options.method, headers: this._options.headers });
				const result = await this._createResult(res);
				if (result.ok) {
					return result;
				} else {
					throw new HTTPError(`${res.status} ${res.statusText}`, result);
				}
			} catch (error) {
				throw new HTTPError(`${error.status} ${error.statusText}`, await this._createResult(error));
			}
	}

	private _createResult(response: Response): Promise<Result> {
		return new Promise((resolve) => {
			const headers: StringObject = {};
			for (const [key, value] of response.headers.entries() as any) {
				if (key && value) headers[key] = value;
			}
			let result = '';
			response.body.on('data', chunk => { result += chunk; });
			response.body.on('end', () => resolve({
				get body() {
					const type = response.headers.get('content-type');
					let parsed;
					if (type) {
						if (/application\/json/.test(type)) {
							try {
								parsed = JSON.parse(result);
							} catch (_) {
								parsed = String(result);
							}
						} else if (/application\/x-www-form-urlencoded/.test(type)) {
							parsed = parse(result);
						}
					}
					if (!parsed) parsed = result;
					return parsed;
				},
				raw: result,
				ok: response.ok,
				statusCode: response.status,
				statusText: response.statusText,
				headers
			}));
		});
	}
}
