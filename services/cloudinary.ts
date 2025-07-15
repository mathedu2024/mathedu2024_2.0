import { v2 as cloudinary } from 'cloudinary';

// Cloudinary 配置
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret',
});

// 上傳圖片到 Cloudinary
export const uploadImageToCloudinary = async (file: File, folder: string = 'course-covers'): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = await cloudinary.uploader.upload(
          reader.result as string,
          {
            folder: folder,
            resource_type: 'image',
            transformation: [
              { width: 800, height: 600, crop: 'fill' },
              { quality: 'auto', fetch_format: 'auto' }
            ]
          }
        );
        resolve(result.secure_url);
      } catch (error) {
        console.error('Cloudinary upload error:', error);
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

// 刪除 Cloudinary 中的圖片
export const deleteImageFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

// 從 URL 中提取 public_id
export const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
      const version = urlParts[uploadIndex + 1];
      const pathParts = urlParts.slice(uploadIndex + 2);
      const fullPath = pathParts.join('/');
      const extensionIndex = fullPath.lastIndexOf('.');
      return extensionIndex !== -1 ? fullPath.substring(0, extensionIndex) : fullPath;
    }
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

export default cloudinary; 