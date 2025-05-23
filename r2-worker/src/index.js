/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env) {
		try {
			const url = new URL(request.url);
			console.log('Request URL:', url);
			const key = url.pathname.slice(1);

			switch (request.method) {
				case 'PUT':
					console.log('Handling PUT request');
					// Parse the request body to extract fields
					const formData = await request.formData();
					const Filename = formData.get('Filename');
					const type = formData.get('type');
					const file = formData.get('file');

					await env.MY_BUCKET.put(key, file);
					console.log(`Uploaded ${Filename} successfully! Type: ${type}`);
					return new Response(`Uploaded ${Filename} successfully! Type: ${type}`);
				case 'GET':
					console.log('Handling GET request');
					const range = request.headers.get('Range');

					//Return the whole object if no range is specified
					if (!range) {
						const obj = await env.MY_BUCKET.get(key);
						if (!obj) return new Response('Not found', { status: 404 });
						return new Response(obj.body, {
							status: 200,
							headers: {
								'Content-Type': obj.httpMetadata.contentType || 'application/octet-stream',
								'Content-Length': obj.size,
							},
						});
					}

					// Parse a single byte-range request: "bytes=start-end"
					const match = range.match(/bytes=(\d+)-(\d*)/);
					if (!match) return new Response('Invalid Range', { status: 416 });

					const start = Number(match[1]);
					const end = match[2] ? Number(match[2]) : undefined;
					const length = end !== undefined ? end - start + 1 : undefined;

					// Fetch only that range from R2
					const obj = await env.MY_BUCKET.get(key, { range: { offset: start, length } });
					if (!obj) return new Response('Not found', { status: 404 });

					// Compute actual end (in case `length` exceeds object size)
					const actualEnd = obj.range?.offset !== undefined ? obj.range.offset + obj.range.length - 1 : obj.size - 1;

					return new Response(obj.body, {
						status: 206,
						headers: {
							'Content-Type': obj.httpMetadata.contentType || 'application/octet-stream',
							'Accept-Ranges': 'bytes',
							'Content-Range': `bytes ${start}-${actualEnd}/${obj.size}`,
							'Content-Length': obj.range.length,
						},
					});
				case 'DELETE':
					console.log('Handling DELETE request');
					await env.MY_BUCKET.delete(key);
					return new Response('Deleted!');
				default:
					console.log('Invalid request method');
					return new Response('Method Not Allowed', {
						status: 405,
						headers: {
							Allow: 'PUT, GET, DELETE',
						},
					});
			}
		} catch (error) {
			console.error('Error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
};
