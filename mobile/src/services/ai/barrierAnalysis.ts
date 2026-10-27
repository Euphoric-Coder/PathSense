import * as ImageManipulator from 'expo-image-manipulator';
import { callAIEndpoint } from './provider';
import { AnalyzeImageResult } from './types';
import { ProfileId } from '@/src/types/pathsense';

export interface AnalyzeBarrierOptions {
  latitude?: number;
  longitude?: number;
  profileId?: ProfileId;
  fixtureId?: string;
}

/**
 * Analyzes a pedestrian accessibility barrier photo using the PathSense AI endpoint.
 *
 * Automatically resizes large camera photos to a max dimension of ~1280px with JPEG
 * quality 0.7 to avoid uploading massive multi-megabyte raw photos while preserving
 * visual accessibility barrier features.
 */
export async function analyzeBarrierImage(
  imageUri: string,
  options?: AnalyzeBarrierOptions
): Promise<AnalyzeImageResult> {
  if (!imageUri) {
    throw new Error('No image URI provided.');
  }

  let base64Data: string;

  try {
    // Compress and resize image for optimal AI vision processing
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1280 } }],
      {
        compress: 0.75,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated.base64) {
      throw new Error('Failed to extract base64 data from compressed image.');
    }

    base64Data = manipulated.base64;
  } catch (compErr: any) {
    console.warn('[barrierAnalysis] Image compression failed, attempting direct upload:', compErr);
    // If manipulation fails for some reason (e.g. data URI or mock), fallback to using uri
    base64Data = imageUri;
  }

  // Call the secure AI analysis backend
  return await callAIEndpoint({
    image: base64Data,
    latitude: options?.latitude,
    longitude: options?.longitude,
    mobilityProfile: options?.profileId,
    fixtureId: options?.fixtureId,
  });
}
