import express from 'express';
import { db } from './db';
import { feedback, insertFeedbackSchema, type SelectFeedback, type InsertFeedback } from '@shared/schema';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = express.Router();

// Estendi i tipi Express per includere user (Passport.js)
declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: string;
    }
  }
}

// Middleware per autenticazione (compatibile con Passport.js)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Middleware per verificare se l'utente è admin
const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/feedback - Get all feedback (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Simple check for admin role - extend this based on your user role system
    // For now, we'll check if user has admin role or just allow any authenticated user to see aggregated data
    
    const allFeedback = await db
      .select({
        id: feedback.id,
        category: feedback.category,
        feature: feedback.feature,
        rating: feedback.rating,
        npsScore: feedback.npsScore,
        title: feedback.title,
        description: feedback.description,
        priority: feedback.priority,
        status: feedback.status,
        createdAt: feedback.createdAt,
        userId: feedback.userId,
      })
      .from(feedback)
      .orderBy(desc(feedback.createdAt));

    res.json({ feedback: allFeedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// POST /api/feedback - Submit new feedback
router.post('/', async (req, res) => {
  try {
    console.log('[FEEDBACK] Submitting feedback:', req.body);
    
    // Validate request body
    const validatedData = insertFeedbackSchema.parse(req.body);
    
    // Add user info if authenticated
    const feedbackData: InsertFeedback & { userId?: number } = {
      ...validatedData,
      userId: req.isAuthenticated() ? req.user!.id : undefined,
    };

    // Add browser and page context if available
    if (req.headers['user-agent']) {
      feedbackData.userAgent = req.headers['user-agent'];
    }
    
    if (req.headers.referer) {
      feedbackData.url = req.headers.referer;
    }

    const [newFeedback] = await db
      .insert(feedback)
      .values(feedbackData)
      .returning();

    console.log('[FEEDBACK] Feedback saved with ID:', newFeedback.id);

    res.status(201).json({ 
      success: true,
      feedback: newFeedback,
      message: 'Feedback submitted successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[FEEDBACK] Validation error:', error.errors);
      return res.status(400).json({ 
        error: 'Invalid feedback data',
        details: error.errors 
      });
    }
    
    console.error('[FEEDBACK] Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/feedback/stats - Get feedback statistics (admin only)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // Get total feedback count
    const [totalCount] = await db
      .select({ count: count() })
      .from(feedback);

    // Get feedback by category
    const categoryStats = await db
      .select({
        category: feedback.category,
        count: count(),
      })
      .from(feedback)
      .groupBy(feedback.category);

    // Get feedback by status
    const statusStats = await db
      .select({
        status: feedback.status,
        count: count(),
      })
      .from(feedback)
      .groupBy(feedback.status);

    // Get average rating
    const [avgRating] = await db
      .select({
        averageRating: sql<number>`AVG(${feedback.rating})`,
      })
      .from(feedback)
      .where(sql`${feedback.rating} IS NOT NULL`);

    // Get average NPS score
    const [avgNPS] = await db
      .select({
        averageNPS: sql<number>`AVG(${feedback.npsScore})`,
      })
      .from(feedback)
      .where(sql`${feedback.npsScore} IS NOT NULL`);

    // Get recent feedback trends (last 30 days)
    const recentFeedback = await db
      .select({
        date: sql<string>`DATE(${feedback.createdAt})`,
        count: count(),
      })
      .from(feedback)
      .where(sql`${feedback.createdAt} >= NOW() - INTERVAL '30 days'`)
      .groupBy(sql`DATE(${feedback.createdAt})`)
      .orderBy(sql`DATE(${feedback.createdAt})`);

    res.json({
      totalFeedback: totalCount.count,
      categoryBreakdown: categoryStats,
      statusBreakdown: statusStats,
      averageRating: Math.round((avgRating?.averageRating || 0) * 10) / 10,
      averageNPS: Math.round((avgNPS?.averageNPS || 0) * 10) / 10,
      recentTrends: recentFeedback,
    });
  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ error: 'Failed to fetch feedback statistics' });
  }
});

// PUT /api/feedback/:id/status - Update feedback status (admin)
router.put('/:id/status', requireAdmin, async (req, res) => {
  try {
    const feedbackId = parseInt(req.params.id);
    const { status, adminResponse } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (adminResponse) {
      updateData.adminResponse = adminResponse;
      updateData.respondedAt = new Date();
      updateData.respondedBy = req.user!.id;
    }

    const [updatedFeedback] = await db
      .update(feedback)
      .set(updateData)
      .where(eq(feedback.id, feedbackId))
      .returning();

    if (!updatedFeedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    console.log('[FEEDBACK] Status updated for feedback ID:', feedbackId, 'New status:', status);

    res.json({ 
      success: true,
      feedback: updatedFeedback 
    });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    res.status(500).json({ error: 'Failed to update feedback status' });
  }
});

// GET /api/feedback/my - Get current user's feedback
router.get('/my', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const userFeedback = await db
      .select()
      .from(feedback)
      .where(eq(feedback.userId, userId))
      .orderBy(desc(feedback.createdAt));

    res.json({ feedback: userFeedback });
  } catch (error) {
    console.error('Error fetching user feedback:', error);
    res.status(500).json({ error: 'Failed to fetch user feedback' });
  }
});

// DELETE /api/feedback/:id - Delete a specific feedback (user can only delete their own)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const feedbackId = parseInt(req.params.id);
    const userId = req.user!.id;

    if (isNaN(feedbackId)) {
      return res.status(400).json({ error: 'Invalid feedback ID' });
    }

    // Check if feedback exists and belongs to the user
    const existingFeedback = await db
      .select()
      .from(feedback)
      .where(and(eq(feedback.id, feedbackId), eq(feedback.userId, userId)))
      .limit(1);

    if (existingFeedback.length === 0) {
      return res.status(404).json({ error: 'Feedback not found or access denied' });
    }

    // Delete the feedback
    const [deletedFeedback] = await db
      .delete(feedback)
      .where(and(eq(feedback.id, feedbackId), eq(feedback.userId, userId)))
      .returning();

    console.log('[FEEDBACK] Deleted feedback ID:', feedbackId, 'by user:', userId);

    res.json({ 
      success: true, 
      message: 'Feedback deleted successfully',
      deletedFeedback 
    });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// DELETE /api/feedback/all - Delete all feedback for the current user
router.delete('/all', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Delete all feedback for the user
    const deletedFeedbacks = await db
      .delete(feedback)
      .where(eq(feedback.userId, userId))
      .returning();

    console.log('[FEEDBACK] Deleted all feedback for user:', userId, 'Count:', deletedFeedbacks.length);

    res.json({ 
      success: true, 
      message: 'All feedback deleted successfully',
      deletedCount: deletedFeedbacks.length 
    });
  } catch (error) {
    console.error('Error deleting all feedback:', error);
    res.status(500).json({ error: 'Failed to delete all feedback' });
  }
});

export default router;