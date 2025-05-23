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

			// Declare variables outside switch
			let formData, Filename, type, file, obj, range, bytes, start, end;
			let contentLength, headers, object;

			switch (request.method) {
				case 'PUT': {
					console.log('Handling PUT request');
					formData = await request.formData();
					Filename = formData.get('Filename');
					type = formData.get('type');
					file = formData.get('file');

					await env.MY_BUCKET.put(key, file);
					console.log(`Uploaded ${Filename} successfully! Type: ${type}`);
					return new Response(`Uploaded ${Filename} successfully! Type: ${type}`, {
						headers: {
							'Access-Control-Allow-Origin': '*',
						},
					});
				}

				case 'GET': {
					console.log('Handling GET request');
					range = request.headers.get('Range');

					if (!range) {
						obj = await env.MY_BUCKET.get(key);
						if (!obj) return new Response('Not found', { status: 404 });
						return new Response(obj.body, {
							status: 200,
							headers: {
								'Content-Type': obj.httpMetadata.contentType || 'application/octet-stream',
								'Content-Length': obj.size,
								'Access-Control-Allow-Origin': '*',
							},
						});
					}

					object = await env.MY_BUCKET.get(key);
					if (!object) return new Response('Not found', { status: 404 });

					bytes = range.replace('bytes=', '').split('-');
					start = parseInt(bytes[0], 10);
					end = bytes[1] ? parseInt(bytes[1], 10) : object.size - 1;

					contentLength = end - start + 1;
					headers = new Headers({
						'Content-Range': `bytes ${start}-${end}/${object.size}`,
						'Accept-Ranges': 'bytes',
						'Content-Length': contentLength,
						'Content-Type': object.httpMetadata.contentType || 'application/octet-stream',
						'Access-Control-Allow-Origin': '*',
						'Cache-Control': 'public, max-age=31536000',
					});

					return new Response(object.body.slice(start, end + 1), {
						status: 206,
						headers,
					});
				}

				case 'DELETE': {
					console.log('Handling DELETE request');
					await env.MY_BUCKET.delete(key);
					return new Response('Deleted!', {
						headers: {
							'Access-Control-Allow-Origin': '*',
						},
					});
				}

				default:
					return new Response('Method Not Allowed', {
						status: 405,
						headers: {
							Allow: 'PUT, GET, DELETE',
							'Access-Control-Allow-Origin': '*',
						},
					});
			}
		} catch (error) {
			console.error('Error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
};
