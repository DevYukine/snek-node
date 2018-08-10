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
	raw: Promise<string>;
	ok: boolean;
	statusCode: number;
	statusText: string;
	headers: StringObject;
}

export class HTTPError extends Error {
	constructor (message: string, res: Result) {
		super(message);
		Object.assign(this, res);
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
		this._options.userAgent = options.userAgent || 'better-fetch';
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
		return new Promise<Result>((resolve, reject) => {
			if (this._options.query) {
				let index = 0;
				for (const key of Object.keys(this._options.query)) {
					this._options.url += `${!index ? '?' : '&'}${key}=${this._options.query[key]}`;
					index++;
				}
			}
			if (!this._options.headers['user-agent']) this.set('user-agent', this._options.userAgent);
			fetch(this._options.url, { body: this._options.body, method: this._options.method, headers: this._options.headers })
				.then(res => {
					const result = this._getResult(res);
					if (result.ok) {
						resolve(result);
					} else {
						reject(new HTTPError(`${res.status} ${res.statusText}`, result));
					}
				})
				.catch(error => reject(new HTTPError(`${error.status} ${error.statusText}`, this._getResult(error))));
		});
	}

	private _getResult(response: Response): Result {
		const headers: StringObject = {};
		for (const [key, value] of response.headers.entries() as any) {
			if (key && value) headers[key] = value;
		}
		return {
			async body() {
				const type = response.headers.get('content-type');
				const raw = await this.raw;
				let parsed;
				if (type) {
					if (/application\/json/.test(type)) {
						try {
							parsed = JSON.parse(raw);
						} catch (_) {
							parsed = String(raw);
						}
					} else if (/application\/x-www-form-urlencoded/.test(type)) {
						parsed = parse(raw);
					}
				}
				if (!parsed) parsed = raw;
				return parsed;
			},
			raw: response.text(),
			ok: response.ok,
			statusCode: response.status,
			statusText: response.statusText,
			headers
		};
	}
}
