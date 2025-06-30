import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { checkPermission } from '@/lib/permission';
import { getRandomImage, trackDownload, UnsplashImage } from '@/lib/unsplash';
// TODO: Import necessary AI SDKs (e.g., OpenAI)

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Using imported getUserFromToken from auth-utils

// Define types for our data structures
interface GenerationTask {
  mainKeyword: string;
  title: string;
  keywords: string;
  outline: string;
}

interface GeneratedContentItem {
  id?: string;
  title: string;
  content: string;
  status: 'success' | 'error' | 'generating';
  workspace: string;
  error?: string;
  featuredImage?: {
    url: string;
    alt: string;
    attribution: {
      authorName: string;
      authorLink: string;
    };
  };
}

// Function to verify table schema
async function verifyDatabaseSchema() {
  console.log('Verifying database schema...');
  
  // Get the admin client
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Failed to initialize Supabase admin client');
    return false;
  }
  
  try {
    // Instead of checking information_schema, try to query the table directly
    const { data, error } = await supabaseAdmin
      .from('generated_content')
      .select('id')
      .limit(1);
    
    if (error) {
      // Table likely doesn't exist, try to create it if possible
      console.error('Error accessing generated_content table:', error);
      
      // Try to create the table if we have permission, but don't fail if we can't
      try {
        // Try to create the table directly
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS public.generated_content (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            workspace_id UUID NOT NULL,
            user_id UUID NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            status TEXT DEFAULT 'generating',
            generation_progress INTEGER DEFAULT 0,
            batch_id UUID,
            error_message TEXT,
            generation_settings JSONB,
            language TEXT,
            article_type TEXT,
            size TEXT,
            tone_of_voice TEXT,
            ai_model TEXT,
            point_of_view TEXT,
            has_images BOOLEAN DEFAULT false,
            has_videos BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `;
        
        // We might not have permission to use RPC, just log the error if we can't
        try {
          console.log('Attempting to create table using RPC...');
          const { error: createError } = await supabaseAdmin.rpc('execute_sql', { query: createTableSQL });
          
          if (createError) {
            console.error('Error creating table using RPC:', createError);
          } else {
            console.log('Created generated_content table successfully');
            return true;
          }
        } catch (rpcError) {
          console.error('RPC not available for table creation:', rpcError);
        }
        
        // If we reach here, we couldn't create the table
        // Return true anyway to continue with generation - we'll handle errors during insert
        console.log('Proceeding without table verification');
        return true;
      } catch (createError) {
        console.error('Error during table creation attempt:', createError);
        // Continue even with errors
        return true;
      }
    }
    
    console.log('The generated_content table exists');
    return true;
  } catch (error) {
    console.error('Error verifying database schema:', error);
    // Continue even with errors
    return true;
  }
}

/**
 * Fetches additional images from Unsplash and inserts them into article content
 */
async function insertImagesIntoContent(
  content: string, 
  apiKey: string, 
  keyword: string,
  numberOfImages: number = 3,
  imageSize: string = '1344x768',
  imageStyle: string = '',
  brandName: string = '',
  distributeEvenly: boolean = true
): Promise<string> {
  if (!apiKey || !content) return content;
  
  try {
    console.log(`Fetching ${numberOfImages} images for keyword "${keyword}"...`);
    
    // Split content by headings (## or ###) to find good places to insert images
    const sections = content.split(/(?=#{2,3}\s)/);
    if (sections.length <= 1) {
      console.log('Content does not have enough sections for inserting images');
      return content;
    }
    
    // Always leave the first section (intro) without an image since we'll have a featured image
    const insertPoints: number[] = [];
    for (let i = 1; i < sections.length; i++) {
      if (insertPoints.length < numberOfImages) {
        insertPoints.push(i);
      }
    }
    
    // If we don't have enough sections, limit the number of images
    const actualNumberOfImages = Math.min(numberOfImages, insertPoints.length);
    console.log(`Will insert ${actualNumberOfImages} images at ${insertPoints.length} insertion points`);
    
    if (actualNumberOfImages === 0) {
      console.log('No suitable insertion points found for images');
      return content;
    }
    
    // Fetch images with style preference
    const images: UnsplashImage[] = [];
    for (let i = 0; i < actualNumberOfImages; i++) {
      try {
        // Create search query with style preference
        let searchQuery = keyword;
        if (imageStyle) {
          searchQuery = `${keyword} ${imageStyle}`;
        }
        
        const image = await getRandomImage(searchQuery, apiKey);
        if (image && image.id !== 'local-fallback') {
          // Track the download as required by Unsplash API terms
          await trackDownload(image.id);
          images.push(image);
          console.log(`Fetched image ${i+1}/${actualNumberOfImages}: ${image.id} with style: ${imageStyle || 'default'}`);
        }
      } catch (error) {
        console.error(`Error fetching image ${i+1}:`, error);
      }
    }
    
    if (images.length === 0) {
      console.log('Failed to fetch any images');
      return content;
    }
    
    console.log(`Successfully fetched ${images.length} images`);
    
    // Insert images into content
    let updatedSections = [...sections];
    for (let i = 0; i < Math.min(images.length, insertPoints.length); i++) {
      const insertPoint = insertPoints[i];
      const image = images[i];
      
      // Create markdown image with attribution and brand context
      let altText = image.alt_text;
      if (brandName) {
        altText = `${altText} - ${brandName}`;
      }
      
      const imageMarkdown = `

<div class="image-container">

![${altText}](${image.url})

<small>Photo by [${image.author.name}](${image.author.link}?utm_source=app&utm_medium=referral) on [Unsplash](https://unsplash.com/?utm_source=app&utm_medium=referral)</small>

</div>

`;
      
      // Add the image after the heading
      const section = updatedSections[insertPoint];
      const headingEnd = section.indexOf('\n') + 1;
      updatedSections[insertPoint] = 
        section.substring(0, headingEnd) + 
        imageMarkdown + 
        section.substring(headingEnd);
    }
    
    return updatedSections.join('');
  } catch (error) {
    console.error('Error inserting images into content:', error);
    return content; // Return original content on error
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Server configuration error', success: false }, { status: 500 });
    }

    // Verify database schema first
    await verifyDatabaseSchema();
    
    console.log('User ID from session:', user.id);
    
    let config;
    try {
      config = await request.json();
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return NextResponse.json({ error: 'Invalid request format', success: false }, { status: 400 });
    }

    // Validate workspace ID
    if (!config?.workspaceId) {
      console.log('No workspace ID provided');
      return NextResponse.json({ error: 'Workspace ID is required', success: false }, { status: 400 });
    }

    console.log('Processing request for workspace ID:', config.workspaceId);

    // Check if user has access to the workspace
    let hasAccess = false;
    console.log('Checking workspace membership...');
    try {
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', config.workspaceId)
      .maybeSingle();

      if (membershipError) {
        console.error('Error checking workspace membership:', membershipError);
      } else if (membership) {
        hasAccess = true;
        console.log('User is a member of the workspace');
      }
    } catch (error) {
      console.error('Exception checking workspace membership:', error);
    }

    // If not a member, check if user is the owner
    if (!hasAccess) {
      console.log('Checking if user owns the workspace...');
      try {
        const { data: ownedWorkspace, error: ownershipError } = await supabase
          .from('workspaces')
          .select('*')
          .eq('id', config.workspaceId)
          .eq('owner_id', user.id)
          .maybeSingle();
          
        if (ownershipError) {
          console.error('Error checking workspace ownership:', ownershipError);
        } else if (ownedWorkspace) {
          hasAccess = true;
          console.log('User is the owner of the workspace');
        }
      } catch (error) {
        console.error('Exception checking workspace ownership:', error);
      }
    }

    if (!hasAccess) {
      console.log('User does not have access to this workspace');
      return NextResponse.json({ error: 'Access to this workspace denied', success: false }, { status: 403 });
    }

    // Get OpenAI API key based on user preference
    let apiKey = process.env.OPENAI_API_KEY; // Default system key
    
    // Check if user wants to use their own API key
    if (config.aiSettings?.useApiKey) {
      console.log('User opted to use their own API key, fetching from workspace settings...');
      try {
        const { data: workspaceSettings, error: settingsError } = await supabase
          .from('workspace_settings')
          .select('openai_api_key')
          .eq('workspace_id', config.workspaceId)
          .maybeSingle();

        if (settingsError) {
          console.error('Error fetching workspace settings:', settingsError);
          return NextResponse.json({ 
            error: 'Failed to fetch your API key. Please check your settings.', 
            success: false 
          }, { status: 400 });
        } else if (workspaceSettings?.openai_api_key) {
          apiKey = workspaceSettings.openai_api_key;
          console.log('Using user-provided API key');
        } else {
          console.error('User requested to use own API key but none found in settings');
          return NextResponse.json({ 
            error: 'No API key found in your settings. Please add one or use the system key.', 
            success: false 
          }, { status: 400 });
        }
      } catch (e) {
        console.error('Exception fetching workspace settings:', e);
        return NextResponse.json({ 
          error: 'Failed to fetch API key settings', 
          success: false 
        }, { status: 500 });
      }
    } else {
      console.log('Using system API key');
    }
    
    if (!apiKey) {
      console.log('No API key available');
      return NextResponse.json({ error: 'No API key available for content generation', success: false }, { status: 400 });
    }

    console.log('API key available:', apiKey ? 'Yes (key hidden)' : 'No');

    // Generate a UUID batch ID if not provided
    const batchId = config.batchId || crypto.randomUUID();
    console.log('Batch ID:', batchId);
    
    // Process generation tasks one by one
    const generatedContent: GeneratedContentItem[] = [];
    const generationTasks = Array.isArray(config.generationTasks) ? config.generationTasks : [];
    const validTasks = generationTasks.filter(
      (task: any) => task && (task.mainKeyword || task.title)
    );
    
    const totalTasks = validTasks.length;
    console.log(`Processing ${totalTasks} generation tasks`);
    
    if (totalTasks === 0) {
      return NextResponse.json({ 
        error: 'No valid generation tasks found',
        success: false,
        data: []
      }, { status: 400 });
    }
    
    let completedTasks = 0;
    
    // Generate content for each task
    for (const task of validTasks) {
      // Create title if it doesn't exist
      const title = task.title || `Article about ${task.mainKeyword}`;
      console.log(`\nProcessing task: "${title}"`);
      
      let recordId: string | null = null;
      
      try {
        // First check if a record with this batch ID already exists
        console.log('Checking for existing record with batch ID:', batchId);
        try {
          const { data: existingRecord, error: existingError } = await supabaseAdmin
            .from('generated_content')
            .select('id')
            .eq('batch_id', batchId)
            .eq('workspace_id', config.workspaceId)
            .maybeSingle();
            
          if (!existingError && existingRecord?.id) {
            recordId = existingRecord.id;
            console.log('Found existing record with ID:', recordId);
          } else {
            console.log('No existing record found, creating new one');
            // Create a new record
            const { data: initialRecord, error: initialError } = await supabaseAdmin
          .from('generated_content')
          .insert({
            workspace_id: config.workspaceId,
            user_id: user.id,
            title: title,
            content: '',
            status: 'generating',
            generation_progress: 0,
            batch_id: batchId,
            generation_settings: config,
                language: config.coreSettings?.language,
                article_type: config.coreSettings?.articleType,
                size: config.coreSettings?.articleSize,
                tone_of_voice: config.contentSettings?.toneOfVoice,
                ai_model: config.aiSettings?.aiModel,
                point_of_view: config.aiSettings?.pointOfView,
                has_images: config.mediaHub?.aiImages !== 'none',
                has_videos: config.mediaHub?.youtubeVideos !== 'none'
          })
          .select('id')
          .single();
          
        if (initialError) {
          console.error('Error creating initial record:', initialError);
              // Continue anyway, we'll create content without DB record if needed
            } else {
              recordId = initialRecord?.id || null;
              console.log('Created initial record with ID:', recordId);
        }
          }
        } catch (dbError) {
          console.error('Exception working with initial record:', dbError);
          // Continue anyway, we'll create content without DB record if needed
        }
        
        // Only proceed if we have a valid record ID
        if (!recordId) {
          throw new Error('No record ID returned from database');
        }
        
        // Update progress to 10% - Starting generation
        console.log('Updating progress to 10%...');
        try {
          const { error: progressError1 } = await supabaseAdmin
          .from('generated_content')
          .update({ generation_progress: 10 })
          .eq('id', recordId);
            
          if (progressError1) {
            console.error('Error updating progress to 10%:', progressError1);
          }
        } catch (e) {
          console.error('Exception updating progress to 10%:', e);
        }
        
        // Construct prompt based on configuration
        console.log('Constructing prompt...');
        const prompt = constructPrompt(task, config);
        
        // Update progress to 20% - Prompt constructed
        console.log('Updating progress to 20%...');
        try {
          const { error: progressError2 } = await supabaseAdmin
          .from('generated_content')
          .update({ generation_progress: 20 })
          .eq('id', recordId);
            
          if (progressError2) {
            console.error('Error updating progress to 20%:', progressError2);
          }
        } catch (e) {
          console.error('Exception updating progress to 20%:', e);
        }
        
        // Generate content with OpenAI
        console.log('Generating content with OpenAI...');
        const content = await generateWithOpenAI(prompt, apiKey, config.aiSettings?.aiModel, 
          // Progress callback
          async (progress: number) => {
            // Map progress from 0-100 to 20-90 range (20% for setup, 70% for generation, 10% for saving)
            const mappedProgress = Math.floor(20 + (progress * 0.7));
            console.log(`Updating progress to ${mappedProgress}% for record ID: ${recordId}...`);
            try {
              const { data, error: progressError } = await supabaseAdmin
              .from('generated_content')
              .update({ generation_progress: mappedProgress })
              .eq('id', recordId)
              .select('id, generation_progress')
              .single();
                
              if (progressError) {
                console.error(`Error updating progress to ${mappedProgress}%:`, progressError);
              } else if (data) {
                console.log(`Successfully updated progress for record ID: ${data.id} to ${data.generation_progress}%`);
              } else {
                console.log(`No data returned when updating progress to ${mappedProgress}%`);
              }
            } catch (e) {
              console.error(`Exception updating progress to ${mappedProgress}%:`, e);
            }
          }
        );
        
        if (!content) {
          console.error('Content generation failed - no content returned');
          throw new Error('Failed to generate content');
        }
        
        // Update progress to 90% - Content generated
        console.log('Content generated successfully. Length:', content.length);
        console.log('Updating progress to 90%...');
        try {
          const { error: progressError3 } = await supabaseAdmin
          .from('generated_content')
          .update({ generation_progress: 90 })
          .eq('id', recordId);
            
          if (progressError3) {
            console.error('Error updating progress to 90%:', progressError3);
          }
        } catch (e) {
          console.error('Exception updating progress to 90%:', e);
        }
        
        // Fetch featured image if Unsplash is enabled
        let featuredImage: UnsplashImage | null = null;
        if (config.mediaHub?.aiImages === 'unsplash' && config.mediaHub?.unsplashApiKey) {
          console.log('Fetching featured image from Unsplash...');
          try {
            // Use the main keyword as the search term for relevance
            const searchTerm = task.mainKeyword || title;
            featuredImage = await getRandomImage(searchTerm, config.mediaHub.unsplashApiKey);
            
            if (featuredImage && featuredImage.id !== 'local-fallback') {
              // Track the download as required by Unsplash API terms
              await trackDownload(featuredImage.id);
              console.log('Featured image fetched successfully:', featuredImage.id);
            } else {
              console.log('No image or fallback image returned from Unsplash');
            }
          } catch (imageError) {
            console.error('Error fetching Unsplash image:', imageError);
            // Continue without image if there's an error
          }
        } else {
          console.log('Unsplash images not enabled or API key missing');
        }
        
        let processedContent = content;
        
        // Insert additional images into content if configured
        if (config.mediaHub?.aiImages === 'unsplash' && 
            config.mediaHub?.unsplashApiKey && 
            config.mediaHub?.numberOfImages > 0) {
          try {
            console.log('Inserting additional images into content...');
            processedContent = await insertImagesIntoContent(
              content,
              config.mediaHub.unsplashApiKey,
              task.mainKeyword || title,
              config.mediaHub.numberOfImages,
              config.mediaHub.imageSize,
              config.mediaHub.imageStyle || '',
              config.mediaHub.brandName || '',
              config.mediaHub.distributeEvenly || true
            );
            console.log('Images inserted successfully');
          } catch (imageError) {
            console.error('Error inserting images into content:', imageError);
            // Continue with original content if image insertion fails
          }
        }
        
        // Update with final content
        console.log('Saving final content to Supabase...');
        try {
          // Prepare update object with content and possibly featured image
          const updateData: any = {
            content: processedContent,
            status: 'success',
            generation_progress: 100,
            updated_at: new Date().toISOString()
          };
          
          // Add featured image data if available
          if (featuredImage) {
            updateData.featured_image_url = featuredImage.url;
            updateData.featured_image_alt = featuredImage.alt_text;
            updateData.featured_image_attribution = {
              author_name: featuredImage.author.name,
              author_username: featuredImage.author.username,
              author_link: featuredImage.author.link,
              unsplash_id: featuredImage.id
            };
          }
          
          const { error: updateError } = await supabaseAdmin
            .from('generated_content')
            .update(updateData)
            .eq('id', recordId);
          
          if (updateError) {
            console.error('Error updating content:', updateError);
            console.error('Error details:', updateError.details, updateError.hint, updateError.message);
            throw new Error(`Database error: ${updateError.message}`);
          }
        } catch (e) {
          console.error('Exception updating final content:', e);
          throw new Error('Failed to save generated content to database');
        }
        
        console.log('Content saved successfully');
          
        // Add to response
        generatedContent.push({
          id: recordId,
          title: title,
          content: processedContent,
          status: 'success',
          workspace: config.workspaceId,
          ...(featuredImage ? {
            featuredImage: {
              url: featuredImage.url,
              alt: featuredImage.alt_text,
              attribution: {
                authorName: featuredImage.author.name,
                authorLink: featuredImage.author.link
              }
            }
          } : {})
        });
        
        console.log('Task completed successfully');
      } catch (taskError) {
        console.error(`Error generating content for task "${title}":`, taskError);
        
        // Try to update the record to error state if we have a record ID
        if (recordId) {
          console.log('Attempting to update record to error state...');
        try {
            // Build update object without error_message
            const updateData: any = {
              status: 'error',
              updated_at: new Date().toISOString()
            };
            
            // Try to add error message if column exists
            try {
              // First check if the column exists
              const { error: columnCheckError } = await supabaseAdmin
                .from('generated_content')
                .select('error_message')
                .eq('id', recordId)
                .limit(1);
                
              if (!columnCheckError) {
                // Column exists, safe to use
                updateData.error_message = taskError instanceof Error ? taskError.message : 'Unknown error';
              } else {
                console.log('Error message column does not exist, skipping that field');
              }
            } catch (columnCheckError) {
              console.error('Error checking column existence:', columnCheckError);
            }
            
            const { error: errorUpdateError } = await supabaseAdmin
              .from('generated_content')
              .update(updateData)
              .eq('id', recordId);
              
            if (errorUpdateError) {
              console.error('Error updating to error state:', errorUpdateError);
            } else {
              console.log('Record updated to error state');
            }
          } catch (updateError) {
            console.error('Failed to update error status:', updateError);
          }
        } else {
          // If we don't have a record ID, try to search by title and batch ID
          console.log('No record ID available, searching for existing record...');
          try {
            const { data: existingRecord, error: searchError } = await supabaseAdmin
            .from('generated_content')
            .select('id')
            .eq('title', title)
            .eq('batch_id', batchId)
            .maybeSingle();
            
            if (searchError) {
              console.error('Error searching for existing record:', searchError);
            }
              
          if (existingRecord?.id) {
              console.log('Found existing record with ID:', existingRecord.id);
              
              // Build update object without error_message
              const updateData: any = {
                status: 'error',
                updated_at: new Date().toISOString()
              };
              
              // Try to add error message if column exists
              try {
                // Check if column exists first
                const { error: columnCheckError } = await supabaseAdmin
                  .from('generated_content')
                  .select('error_message')
                  .eq('id', existingRecord.id)
                  .limit(1);
                  
                if (!columnCheckError) {
                  // Column exists, safe to use
                  updateData.error_message = taskError instanceof Error ? taskError.message : 'Unknown error';
                } else {
                  console.log('Error message column does not exist, skipping that field');
                }
              } catch (columnCheckError) {
                console.error('Error checking column existence:', columnCheckError);
              }
              
              const { error: errorUpdateError } = await supabaseAdmin
                .from('generated_content')
                .update(updateData)
              .eq('id', existingRecord.id);
                
              if (errorUpdateError) {
                console.error('Error updating to error state:', errorUpdateError);
              } else {
                console.log('Record updated to error state');
              }
            } else {
              console.log('No existing record found to update');
            }
          } catch (e) {
            console.error('Exception searching for existing record:', e);
          }
        }
        
        generatedContent.push({
          id: recordId || crypto.randomUUID(),
          title: title,
          content: '',
          status: 'error',
          error: taskError instanceof Error ? taskError.message : 'Unknown error',
          workspace: config.workspaceId
        });
        
        console.log('Task failed');
      }
      
      // Update completion status
      completedTasks++;
      console.log(`Completed ${completedTasks}/${totalTasks} tasks`);
    }
    
    console.log('All tasks processed. Returning response.');
    return NextResponse.json({ success: true, data: generatedContent, batchId });

  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        success: false,
        data: [] 
      },
      { status: 500 }
    );
  }
}

/**
 * Construct a prompt based on the generation task and configuration
 */
function constructPrompt(task: any, config: any): string {
  // Start with system instructions
  let prompt = `You are an expert content writer specializing in creating high-quality, SEO-optimized articles.
  
Write a comprehensive article with the following specifications:

- Title: ${task.title || `Article about ${task.mainKeyword}`}
- Main Keyword: ${task.mainKeyword || 'N/A'}
- Additional Keywords: ${task.keywords || 'N/A'}
${task.outline ? `- Outline: ${task.outline}` : ''}

ARTICLE SPECIFICATIONS:
- Language: ${config.coreSettings.language || 'English (US)'}
- Article Type: ${config.coreSettings.articleType !== 'none' ? config.coreSettings.articleType : 'Informational blog post'}
- Length: ${config.coreSettings.articleSize === 'small' ? 'Short (900-1500 words)' : 
          config.coreSettings.articleSize === 'medium' ? 'Medium (2400-3600 words)' : 
          config.coreSettings.articleSize === 'large' ? 'Long (4000+ words)' : 'Medium (2400-3600 words)'}
- Tone of Voice: ${config.contentSettings.toneOfVoice || 'Professional and informative'}`;

  // Add point of view if specified
  if (config.aiSettings.pointOfView && config.aiSettings.pointOfView !== 'none') {
    prompt += `\n- Point of View: ${config.aiSettings.pointOfView}`;
  }

  // Add readability level if specified
  if (config.aiSettings.textReadability && config.aiSettings.textReadability !== 'none') {
    prompt += `\n- Readability Level: ${config.aiSettings.textReadability}`;
  }

  // Add target country localization
  if (config.aiSettings.targetCountry && config.aiSettings.targetCountry !== 'us') {
    const countryMap: Record<string, string> = {
      'uk': 'United Kingdom (use British English, UK examples, £ currency)',
      'ca': 'Canada (use Canadian English, Canadian examples, CAD currency)', 
      'au': 'Australia (use Australian English, Australian examples, AUD currency)',
      'de': 'Germany (use German context, EUR currency, European examples)',
      'fr': 'France (use French context, EUR currency, European examples)',
      'es': 'Spain (use Spanish context, EUR currency, European examples)',
      'it': 'Italy (use Italian context, EUR currency, European examples)',
      'nl': 'Netherlands (use Dutch context, EUR currency, European examples)',
      'se': 'Sweden (use Swedish context, SEK currency, Nordic examples)',
      'no': 'Norway (use Norwegian context, NOK currency, Nordic examples)',
      'dk': 'Denmark (use Danish context, DKK currency, Nordic examples)'
    };
    
    const countryContext = countryMap[config.aiSettings.targetCountry] || 'United States (use American English, USD currency)';
    prompt += `\n- Target Country: ${countryContext}`;
  }

  // Add AI content cleaning instructions
  if (config.aiSettings.aiContentCleaning && config.aiSettings.aiContentCleaning !== 'none') {
    prompt += `\n\nCONTENT QUALITY REQUIREMENTS:`;
    
    if (config.aiSettings.aiContentCleaning === 'basic') {
      prompt += `\n- Avoid obvious AI phrases like "In conclusion", "It's important to note", "Furthermore", "Moreover"
- Write in a natural, conversational tone
- Vary sentence structure and length
- Use contractions where appropriate`;
    } else if (config.aiSettings.aiContentCleaning === 'advanced') {
      prompt += `\n- Write like a real human expert, not an AI assistant
- Avoid all formulaic phrases and repetitive structures
- Use personal insights and authentic voice
- Include specific examples and real-world applications
- Vary paragraph length naturally
- Use contractions, colloquialisms, and natural speech patterns
- Avoid listing everything in bullet points - integrate information naturally`;
    }
  }

  // Add brand voice if specified
  if (config.aiSettings.brandVoice && config.aiSettings.brandVoice !== 'none') {
    prompt += `\n- Brand Voice: ${config.aiSettings.brandVoice}`;
  }

  // Add details to include if available
  if (config.detailsToInclude?.details) {
    prompt += `\n\nADDITIONAL DETAILS TO INCLUDE:\n${config.detailsToInclude.details}`;
  }

  // Add image and media context
  if (config.mediaHub?.aiImages !== 'none') {
    prompt += `\n\nIMAGE INTEGRATION:`;
    prompt += `\n- ${config.mediaHub.numberOfImages || 3} images will be added to this article`;
    
    if (config.mediaHub.imageStyle) {
      prompt += `\n- Image style preference: ${config.mediaHub.imageStyle}`;
    }
    
    if (config.mediaHub.brandName) {
      prompt += `\n- Brand name for image alt-text: ${config.mediaHub.brandName}`;
      prompt += `\n- Include "${config.mediaHub.brandName}" context where natural in the content`;
    }
    
    if (config.mediaHub.additionalInstructions) {
      prompt += `\n- Image guidance: ${config.mediaHub.additionalInstructions}`;
    }
    
    prompt += `\n- Write with clear section breaks where images would enhance the content`;
    prompt += `\n- Include descriptive context that would work well with relevant images`;
  }

  // Add YouTube video integration if specified
  if (config.mediaHub?.youtubeVideos !== 'none') {
    prompt += `\n\nVIDEO INTEGRATION:`;
    prompt += `\n- ${config.mediaHub.numberOfVideos || 1} video(s) will be embedded in this article`;
    prompt += `\n- Write sections that would benefit from video demonstrations or explanations`;
    prompt += `\n- Include natural places for video embeds in your content structure`;
  }

  // Add external linking strategy
  if (config.linking?.linkType !== 'none') {
    prompt += `\n\nLINKING STRATEGY:`;
    
    if (config.linking.linkType === 'authority') {
      prompt += `\n- Include references to authoritative sources that should be linked`;
      prompt += `\n- Mention industry leaders, research studies, or official resources`;
      prompt += `\n- Write with link-worthy authority sources in mind`;
    } else if (config.linking.linkType === 'related') {
      prompt += `\n- Include natural opportunities for related topic links`;
      prompt += `\n- Mention complementary concepts that could link to other articles`;
    }
    
    if (config.linking.webAccess === 'enabled') {
      prompt += `\n- Include current data, recent statistics, and up-to-date information`;
      prompt += `\n- Reference recent trends and developments in the field`;
    }
  }

  // Add structure requirements
  prompt += `\n\nSTRUCTURE REQUIREMENTS:`;
  
  // Introduction hook
  if (config.structure.introHook) {
    prompt += `\n- Introduction Hook: ${config.structure.introHook}`;
    if (config.structure.hookBrief) {
      prompt += ` (${config.structure.hookBrief})`;
    }
  }
  
  // Structure elements
  const structureElements: string[] = [];
  if (config.structure.includeConclusion) structureElements.push("conclusion");
  if (config.structure.includeTables) structureElements.push("tables where appropriate");
  if (config.structure.includeH3) structureElements.push("H3 subheadings");
  if (config.structure.includeLists) structureElements.push("bullet or numbered lists");
  if (config.structure.includeItalics) structureElements.push("italic text for emphasis");
  if (config.structure.includeQuotes) structureElements.push("relevant quotes");
  if (config.structure.includeTakeaways) structureElements.push("key takeaways section");
  if (config.structure.includeFaq) structureElements.push("FAQ section");
  if (config.structure.includeBold) structureElements.push("bold text for important points");
  
  if (structureElements.length > 0) {
    prompt += `\n- Include: ${structureElements.join(', ')}`;
  }

  // Add syndication context
  const syndicationPlatforms: string[] = [];
  if (config.syndication?.twitterPost) syndicationPlatforms.push("Twitter");
  if (config.syndication?.linkedinPost) syndicationPlatforms.push("LinkedIn");
  if (config.syndication?.facebookPost) syndicationPlatforms.push("Facebook");
  if (config.syndication?.emailNewsletter) syndicationPlatforms.push("Email Newsletter");
  
  if (syndicationPlatforms.length > 0) {
    prompt += `\n\nSYNDICATION CONTEXT:`;
    prompt += `\n- This content will be shared on: ${syndicationPlatforms.join(', ')}`;
    prompt += `\n- Write with social media sharing in mind - include engaging hooks and shareable insights`;
    prompt += `\n- Create content that works well in shorter excerpt formats`;
  }

  // Final formatting instructions
  prompt += `\n\nFormat the article with proper Markdown for headings (H2, H3), lists, emphasis, etc. Make it engaging, informative, and optimized for both readers and search engines.`;

  // Add specific heading formatting guidance
  prompt += `\n\nHEADING FORMATTING REQUIREMENTS:
- Use proper heading hierarchy with # for H1 (main title), ## for H2 (section headers), and ### for H3 (subsection headers)
- Make sure headings are descriptive, compelling, and include relevant keywords where natural
- Use H2 headings to divide the article into major sections
- Use H3 headings for subsections within those major sections
- Ensure a balanced heading structure throughout the article
- Always include a clear introduction before the first heading
- Always include a conclusion section at the end`;

  return prompt;
}

/**
 * Generate content using OpenAI API
 */
async function generateWithOpenAI(
  prompt: string, 
  apiKey: string, 
  model: string = 'default',
  progressCallback?: (progress: number) => Promise<void>
): Promise<string> {
  // Map model selections to actual OpenAI models
  const modelMap: Record<string, string> = {
    'default': 'gpt-3.5-turbo-16k',
    'gpt4': 'gpt-4',
    'gpt4o': 'gpt-4o'
    // Additional models can be mapped here
  };
  
  const openaiModel = modelMap[model] || modelMap.default;
  console.log(`Using OpenAI model: ${openaiModel}`);
  
  try {
    console.log('Calling OpenAI API with prompt length:', prompt.length);
    
    // Safer environment variables check
    if (!apiKey) {
      console.error('Missing OpenAI API key');
      throw new Error('OpenAI API key is required');
    }
    
    // Log the first few characters of the key (safely) to verify it's not empty
    const keyPrefix = apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4);
    console.log(`API key format verification: ${keyPrefix}`);
    
    // Call OpenAI API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout
    
    console.log('Sending request to OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: openaiModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert content writer specializing in creating high-quality, SEO-optimized articles.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: false
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
    
    console.log('OpenAI API response received with status:', response.status);
    
    // For debugging purposes, always update progress to show the process is working
    if (progressCallback) {
      // Report 25% progress
      await progressCallback(25);
      console.log('Progress callback: 25% completed');
      
      // Wait a bit and report 50% progress
      await new Promise(resolve => setTimeout(resolve, 2000));
      await progressCallback(50);
      console.log('Progress callback: 50% completed');
      
      // Wait a bit and report 75% progress
      await new Promise(resolve => setTimeout(resolve, 2000));
      await progressCallback(75);
      console.log('Progress callback: 75% completed');
    }

    // Use a proper error-handling approach for the response
    let errorData;
    let responseText;
    
    try {
      // Try to parse response as JSON first
      responseText = await response.text();
      console.log('Response text length:', responseText.length);
      console.log('Response text preview:', responseText.substring(0, 200) + '...');
      
      try {
        errorData = JSON.parse(responseText);
        console.log('Response parsed as JSON successfully');
      } catch (jsonError) {
        // Not valid JSON, handle as text
        console.log('Response is not valid JSON, treating as text');
      }
    } catch (textError) {
      console.error('Error getting response text:', textError);
      throw new Error('Failed to read API response');
    }

    if (!response.ok) {
      console.error('OpenAI API error response status:', response.status);
      
      // Try to get a meaningful error message
      let errorMessage = 'OpenAI API returned an error';
      
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
      } else if (errorData?.error) {
        errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : JSON.stringify(errorData.error);
      } else if (responseText) {
        // Truncate potentially long error response
        errorMessage = `OpenAI error: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`;
      }
      
      console.error('OpenAI error details:', errorMessage);
      throw new Error(errorMessage);
    }

    // Now parse the successful response
    let data;
    try {
      data = errorData || JSON.parse(responseText);
      console.log('Successfully parsed OpenAI response');
    } catch (parseError) {
      console.error('Error parsing successful response:', parseError);
      throw new Error('Invalid response format from OpenAI API');
    }
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('Unexpected response structure:', JSON.stringify(data));
      throw new Error('Invalid response structure from OpenAI API');
    }
    
    console.log('OpenAI API response received. Content length:', data.choices[0].message.content.length);
    
    // Report 100% progress
    if (progressCallback) {
      await progressCallback(100);
      console.log('Progress callback: 100%');
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Add more detailed logging for specific error types
    if (error instanceof TypeError) {
      console.error('Network error details:', error.message);
    } else if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Request was aborted (timeout)');
    }
    
    if (error instanceof Error) {
      throw error; // Rethrow the original error with its message
    } else {
      throw new Error(`OpenAI error: ${String(error)}`);
    }
  }
} 