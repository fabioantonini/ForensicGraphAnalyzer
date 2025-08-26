import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

interface ImageQualityResult {
  overall: number; // 0-100 overall confidence score
  resolution: {
    score: number; // 0-100
    width: number;
    height: number;
    dpi: number;
    status: 'low' | 'medium' | 'high';
    recommendation?: string;
  };
  contrast: {
    score: number; // 0-100
    value: number; // actual contrast value
    status: 'low' | 'medium' | 'high';
    recommendation?: string;
  };
  sharpness: {
    score: number; // 0-100
    value: number; // sharpness metric
    status: 'low' | 'medium' | 'high';
    recommendation?: string;
  };
  completeness: {
    score: number; // 0-100
    edgePixels: number; // pixels touching edges
    totalPixels: number;
    status: 'cropped' | 'partial' | 'complete';
    recommendation?: string;
  };
  signaturePresence: {
    score: number; // 0-100
    inkPixels: number;
    backgroundPixels: number;
    ratio: number;
    status: 'minimal' | 'adequate' | 'good';
    recommendation?: string;
  };
  recommendations: string[];
  suitableForAnalysis: boolean;
}

/**
 * Analyzes image quality for signature verification
 * @param imagePath Path to the image file
 * @returns Quality analysis results
 */
export async function analyzeImageQuality(imagePath: string): Promise<ImageQualityResult> {
  try {
    // Import fs using ES6 syntax
    const fs = await import('fs');
    
    // Check if file exists
    try {
      await fs.promises.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Check file size
    const stats = await fs.promises.stat(imagePath);
    if (stats.size === 0) {
      throw new Error('Image file is empty');
    }

    const image = sharp(imagePath).rotate(); // Applica automaticamente orientamento EXIF
    const metadata = await image.metadata();
    
    // Validate metadata
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image: missing dimensions');
    }
    
    // Get image statistics
    const imageStats = await image.stats();
    const { data, info } = await image
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Validate buffer data
    if (!data || data.length === 0) {
      throw new Error('Failed to extract image data');
    }

    const width = info.width;
    const height = info.height;
    const totalPixels = width * height;

    // Calculate resolution score
    const resolution = analyzeResolution(width, height, metadata.density || 72);
    
    // Calculate contrast score
    const contrast = analyzeContrast(imageStats.channels[0]);
    
    // Calculate sharpness score
    const sharpness = analyzeSharpness(data, width, height);
    
    // Calculate completeness score
    const completeness = analyzeCompleteness(data, width, height);
    
    // Calculate signature presence
    const signaturePresence = analyzeSignaturePresence(data, totalPixels);

    // Calculate overall confidence
    const overall = calculateOverallConfidence({
      resolution: resolution.score,
      contrast: contrast.score,
      sharpness: sharpness.score,
      completeness: completeness.score,
      signaturePresence: signaturePresence.score
    });

    // Generate recommendations
    const recommendations = generateRecommendations({
      resolution,
      contrast,
      sharpness,
      completeness,
      signaturePresence
    });

    const result: ImageQualityResult = {
      overall,
      resolution,
      contrast,
      sharpness,
      completeness,
      signaturePresence,
      recommendations,
      suitableForAnalysis: overall >= 60 // Minimum threshold for analysis
    };

    return result;
  } catch (error) {
    console.error('Error analyzing image quality:', error);
    throw new Error('Failed to analyze image quality');
  }
}

function analyzeResolution(width: number, height: number, dpi: number) {
  const minDimension = Math.min(width, height);
  const maxDimension = Math.max(width, height);
  
  let score = 0;
  let status: 'low' | 'medium' | 'high' = 'low';
  let recommendation: string | undefined;

  // Ideal signature dimensions: at least 300x150 pixels for good analysis
  if (minDimension >= 200 && maxDimension >= 400 && dpi >= 150) {
    score = 100;
    status = 'high';
  } else if (minDimension >= 150 && maxDimension >= 300 && dpi >= 100) {
    score = 75;
    status = 'medium';
    recommendation = 'Consider using higher resolution for better analysis';
  } else if (minDimension >= 100 && maxDimension >= 200) {
    score = 50;
    status = 'medium';
    recommendation = 'Low resolution may affect analysis accuracy';
  } else {
    score = 25;
    status = 'low';
    recommendation = 'Resolution too low - please use higher quality image';
  }

  return {
    score,
    width,
    height,
    dpi,
    status,
    recommendation
  };
}

function analyzeContrast(channel: { min: number; max: number; mean: number; stdev: number }) {
  const range = channel.max - channel.min;
  const normalizedRange = range / 255;
  
  let score = Math.round(normalizedRange * 100);
  let status: 'low' | 'medium' | 'high' = 'low';
  let recommendation: string | undefined;

  if (normalizedRange >= 0.7) {
    status = 'high';
    score = Math.min(100, score);
  } else if (normalizedRange >= 0.4) {
    status = 'medium';
    recommendation = 'Moderate contrast - consider improving lighting';
  } else {
    status = 'low';
    recommendation = 'Low contrast - improve lighting or use photo editing';
  }

  return {
    score,
    value: normalizedRange,
    status,
    recommendation
  };
}

function analyzeSharpness(data: Buffer, width: number, height: number): any {
  // Sobel edge detection for sharpness measurement
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  let totalGradient = 0;
  let validPixels = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixelIndex = (y + ky) * width + (x + kx);
          const pixelValue = data[pixelIndex];
          
          const kernelIndex = (ky + 1) * 3 + (kx + 1);
          gx += pixelValue * sobelX[kernelIndex];
          gy += pixelValue * sobelY[kernelIndex];
        }
      }
      
      const gradient = Math.sqrt(gx * gx + gy * gy);
      totalGradient += gradient;
      validPixels++;
    }
  }

  const averageGradient = totalGradient / validPixels;
  const normalizedSharpness = Math.min(1, averageGradient / 50); // Normalize to 0-1
  
  let score = Math.round(normalizedSharpness * 100);
  let status: 'low' | 'medium' | 'high' = 'low';
  let recommendation: string | undefined;

  if (normalizedSharpness >= 0.6) {
    status = 'high';
  } else if (normalizedSharpness >= 0.3) {
    status = 'medium';
    recommendation = 'Moderate sharpness - consider using higher quality scan';
  } else {
    status = 'low';
    recommendation = 'Image appears blurry - use sharper image for better results';
  }

  return {
    score,
    value: normalizedSharpness,
    status,
    recommendation
  };
}

function analyzeCompleteness(data: Buffer, width: number, height: number) {
  const edgeThreshold = 50; // Minimum pixel value to consider as "ink"
  let edgePixels = 0;
  
  // Check top and bottom edges
  for (let x = 0; x < width; x++) {
    if (data[x] < 255 - edgeThreshold) edgePixels++; // Top edge
    if (data[(height - 1) * width + x] < 255 - edgeThreshold) edgePixels++; // Bottom edge
  }
  
  // Check left and right edges
  for (let y = 0; y < height; y++) {
    if (data[y * width] < 255 - edgeThreshold) edgePixels++; // Left edge
    if (data[y * width + (width - 1)] < 255 - edgeThreshold) edgePixels++; // Right edge
  }

  const totalEdgePixels = (width + height) * 2;
  const edgeRatio = edgePixels / totalEdgePixels;
  
  let score = Math.round((1 - edgeRatio) * 100);
  let status: 'cropped' | 'partial' | 'complete' = 'complete';
  let recommendation: string | undefined;

  if (edgeRatio > 0.3) {
    score = Math.max(20, score);
    status = 'cropped';
    recommendation = 'Signature appears cropped - ensure full signature is visible';
  } else if (edgeRatio > 0.1) {
    status = 'partial';
    recommendation = 'Signature may be partially cropped';
  }

  return {
    score,
    edgePixels,
    totalPixels: width * height,
    status,
    recommendation
  };
}

function analyzeSignaturePresence(data: Buffer, totalPixels: number) {
  const inkThreshold = 200; // Pixels darker than this are considered ink
  let inkPixels = 0;
  
  for (let i = 0; i < data.length; i++) {
    if (data[i] < inkThreshold) {
      inkPixels++;
    }
  }
  
  const backgroundPixels = totalPixels - inkPixels;
  const inkRatio = inkPixels / totalPixels;
  
  let score = 0;
  let status: 'minimal' | 'adequate' | 'good' = 'minimal';
  let recommendation: string | undefined;

  if (inkRatio >= 0.05 && inkRatio <= 0.3) {
    score = 100;
    status = 'good';
  } else if (inkRatio >= 0.02 && inkRatio <= 0.5) {
    score = 75;
    status = 'adequate';
  } else if (inkRatio < 0.02) {
    score = 30;
    status = 'minimal';
    recommendation = 'Very light signature - ensure good contrast';
  } else {
    score = 40;
    status = 'minimal';
    recommendation = 'Too much ink detected - check for scanning artifacts';
  }

  return {
    score,
    inkPixels,
    backgroundPixels,
    ratio: inkRatio,
    status,
    recommendation
  };
}

function calculateOverallConfidence(scores: {
  resolution: number;
  contrast: number;
  sharpness: number;
  completeness: number;
  signaturePresence: number;
}) {
  // Weighted average with different importance for each factor
  const weights = {
    resolution: 0.25,
    contrast: 0.20,
    sharpness: 0.25,
    completeness: 0.15,
    signaturePresence: 0.15
  };

  const weightedSum = 
    scores.resolution * weights.resolution +
    scores.contrast * weights.contrast +
    scores.sharpness * weights.sharpness +
    scores.completeness * weights.completeness +
    scores.signaturePresence * weights.signaturePresence;

  return Math.round(weightedSum);
}

function generateRecommendations(analysis: {
  resolution: any;
  contrast: any;
  sharpness: any;
  completeness: any;
  signaturePresence: any;
}): string[] {
  const recommendations: string[] = [];
  
  if (analysis.resolution.recommendation) {
    recommendations.push(analysis.resolution.recommendation);
  }
  
  if (analysis.contrast.recommendation) {
    recommendations.push(analysis.contrast.recommendation);
  }
  
  if (analysis.sharpness.recommendation) {
    recommendations.push(analysis.sharpness.recommendation);
  }
  
  if (analysis.completeness.recommendation) {
    recommendations.push(analysis.completeness.recommendation);
  }
  
  if (analysis.signaturePresence.recommendation) {
    recommendations.push(analysis.signaturePresence.recommendation);
  }

  // Add general recommendations based on overall quality
  const overallScore = calculateOverallConfidence({
    resolution: analysis.resolution.score,
    contrast: analysis.contrast.score,
    sharpness: analysis.sharpness.score,
    completeness: analysis.completeness.score,
    signaturePresence: analysis.signaturePresence.score
  });

  if (overallScore < 40) {
    recommendations.push('Image quality too low for reliable analysis');
  } else if (overallScore < 60) {
    recommendations.push('Consider improving image quality for better results');
  } else if (overallScore >= 80) {
    recommendations.push('Excellent image quality for signature analysis');
  }

  return recommendations;
}