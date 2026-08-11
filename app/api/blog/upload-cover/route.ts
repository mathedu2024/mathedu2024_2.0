import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuthFromRequest } from '@/services/apiAuth';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = requireAuthFromRequest(request, 'author');
  if (auth.ok === false) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '請選擇圖片檔案' }, { status: 400 });
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '僅支援圖片檔案' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: '圖片大小需小於 5MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64String = `data:${file.type};base64,${buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(base64String, {
      folder: 'blog-covers',
      resource_type: 'image',
      transformation: [
        { width: 1600, height: 900, crop: 'fill', gravity: 'auto' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return NextResponse.json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      width: result.width,
      height: result.height,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, request);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog cover upload error:', error);
    return NextResponse.json({ error: '上傳失敗' }, { status: 500 });
  }
}
