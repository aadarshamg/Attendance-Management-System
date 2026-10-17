import { ImagesService } from './images.service';

const config = {
  storage: {
    endpoint: 'http://127.0.0.1:1',
    region: 'ap-northeast-2',
    accessKeyId: 'x',
    secretAccessKey: 'y',
    bucket: 'ams-attendance-images',
    forcePathStyle: true,
  },
} as never;

describe('ImagesService.probe', () => {
  it('reports ok when the write and delete succeed', async () => {
    const svc = new ImagesService(config);
    const send = jest.fn().mockResolvedValue({});
    (svc as unknown as { s3: { send: jest.Mock } }).s3.send = send;
    await expect(svc.probe()).resolves.toEqual({ ok: true, bucket: 'ams-attendance-images' });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('names the storage error when the upload is rejected', async () => {
    const svc = new ImagesService(config);
    const err = Object.assign(new Error('The specified bucket does not exist'), {
      name: 'NoSuchBucket',
      Code: 'NoSuchBucket',
      $metadata: { httpStatusCode: 404 },
    });
    (svc as unknown as { s3: { send: jest.Mock } }).s3.send = jest.fn().mockRejectedValue(err);
    await expect(svc.probe()).resolves.toEqual({
      ok: false,
      bucket: 'ams-attendance-images',
      error: 'NoSuchBucket (HTTP 404): The specified bucket does not exist',
    });
  });
});
