import { GoogleGenerativeAI } from "@google/generative-ai";
import { Commit } from "./github";
import { logger } from "./logger";

const MODULE_NAME = "gemini";

export interface CommitSummary {
  keyThemes: string[];
  technicalAreas: {
    name: string;
    count: number;
  }[];
  accomplishments: string[];
  commitsByType: {
    type: string;
    count: number;
    description: string;
  }[];
  timelineHighlights: {
    date: string;
    description: string;
  }[];
  overallSummary: string;
}

export async function generateCommitSummary(
  commits: Commit[],
  apiKey: string
): Promise<CommitSummary> {
  logger.debug(MODULE_NAME, "generateCommitSummary called", { 
    commitsCount: commits.length,
    apiKeyProvided: !!apiKey 
  });

  if (!apiKey) {
    logger.error(MODULE_NAME, "No API key provided");
    throw new Error("Gemini API key is required");
  }

  if (commits.length === 0) {
    logger.info(MODULE_NAME, "No commits provided, returning empty summary");
    return {
      keyThemes: ["No commits found in the selected time period"],
      technicalAreas: [],
      accomplishments: ["No activity in the selected time period"],
      commitsByType: [],
      timelineHighlights: [],
      overallSummary: "No commits were found in the selected time period."
    };
  }

  // Initialize Gemini API
  logger.debug(MODULE_NAME, "Initializing Gemini API");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
  logger.debug(MODULE_NAME, "Gemini API initialized", { 
    modelName: "gemini-1.5-flash",
    maxOutputTokens: 2048,
    temperature: 0.2,
  });

  // Prepare the commit data for analysis
  logger.debug(MODULE_NAME, "Preparing commit data for analysis");
  const commitData = commits.map(commit => ({
    message: commit.commit.message,
    date: commit.commit.author.date,
    author: commit.commit.author.name,
    repository: commit.repository?.full_name || 'unknown',
    url: commit.html_url,
  }));

  logger.debug(MODULE_NAME, "Commit data prepared", { 
    sampleCommit: commits.length > 0 ? {
      message: commits[0].commit.message.substring(0, 100),
      date: commits[0].commit.author.date,
      repo: commits[0].repository?.full_name
    } : null,
    uniqueRepos: Array.from(new Set(commits.map(c => c.repository?.full_name))).length,
    uniqueAuthors: Array.from(new Set(commits.map(c => c.commit.author.name))).length,
    dateRange: commits.length > 0 ? {
      earliest: new Date(commits[commits.length-1].commit.author.date).toISOString(),
      latest: new Date(commits[0].commit.author.date).toISOString()
    } : null
  });

  // Construct the prompt for Gemini
  logger.debug(MODULE_NAME, "Constructing Gemini prompt");
  const prompt = `
    Analyze these GitHub commits and provide a comprehensive summary.
    Generate a JSON response containing the following sections:
    
    1. "keyThemes": An array of 3-5 key themes or focus areas found in these commits
    2. "technicalAreas": An array of objects each containing "name" (technical area like "frontend", "database", "authentication", etc.) and "count" (number of commits in this area)
    3. "accomplishments": An array of 3-7 major accomplishments visible from these commits
    4. "commitsByType": An array of objects with "type" (like "feature", "bugfix", "refactor", "docs", etc.), "count", and "description" fields
    5. "timelineHighlights": An array of chronologically sorted objects with "date" and "description" highlighting key development milestones
    6. "overallSummary": A 2-3 sentence summary of the overall work represented by these commits
    
    The response should be valid JSON that can be parsed directly. Focus on meaningful technical analysis rather than just counting commits.
    Here's the commit data to analyze: ${JSON.stringify(commitData)}
  `;
  logger.debug(MODULE_NAME, "Prompt constructed", { promptLength: prompt.length });

  try {
    logger.info(MODULE_NAME, "Calling Gemini API", { 
      commitsAnalyzed: commits.length,
      promptTokenEstimate: prompt.length / 4 // rough estimate
    });
    
    const startTime = Date.now();
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const endTime = Date.now();
    
    logger.info(MODULE_NAME, "Received Gemini API response", { 
      responseTimeMs: endTime - startTime,
      responseLength: text.length
    });
    logger.debug(MODULE_NAME, "Raw Gemini response", { response: text.substring(0, 500) + (text.length > 500 ? "..." : "") });
    
    // Parse the JSON response
    try {
      // Handle case where Gemini might wrap the JSON in markdown code blocks
      let jsonText = text;
      
      if (text.includes('```json')) {
        logger.debug(MODULE_NAME, "Detected JSON code block with explicit json tag");
        jsonText = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
        logger.debug(MODULE_NAME, "Detected generic code block, attempting to extract JSON");
        jsonText = text.split('```')[1].split('```')[0].trim();
      }
      
      logger.debug(MODULE_NAME, "Attempting to parse JSON response", {
        jsonPreview: jsonText.substring(0, 100) + (jsonText.length > 100 ? "..." : "")
      });
      
      const parsedResponse = JSON.parse(jsonText);
      
      logger.info(MODULE_NAME, "Successfully parsed Gemini response", {
        themeCount: parsedResponse.keyThemes?.length || 0,
        technicalAreasCount: parsedResponse.technicalAreas?.length || 0,
        accomplishmentsCount: parsedResponse.accomplishments?.length || 0,
        commitTypeCount: parsedResponse.commitsByType?.length || 0,
        timelineHighlightsCount: parsedResponse.timelineHighlights?.length || 0
      });
      
      return parsedResponse;
    } catch (parseError) {
      logger.error(MODULE_NAME, "Error parsing Gemini response", { 
        error: parseError,
        rawResponsePreview: text.substring(0, 200) + (text.length > 200 ? "..." : "")
      });
      throw new Error("Failed to parse Gemini API response");
    }
  } catch (error) {
    logger.error(MODULE_NAME, "Error calling Gemini API", { error });
    throw error;
  }
}