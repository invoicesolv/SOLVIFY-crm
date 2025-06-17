# Automation Workflow Builder Guide

## 🔧 New Features Added

### 1. **Split Out & Aggregate Nodes**

#### **Split Out Node** 🔀
- **Purpose**: Splits one workflow path into multiple parallel paths
- **Use Case**: When you want to perform multiple actions simultaneously
- **Example**: After generating a script, split to create both audio AND upload to Google Drive at the same time
- **Visual**: Has multiple output connection points (left and right)

#### **Aggregate Node** 🔗
- **Purpose**: Merges multiple workflow paths back into one
- **Use Case**: Wait for multiple parallel processes to complete before continuing
- **Example**: Wait for both audio generation AND video background selection to finish before starting video rendering
- **Visual**: Has multiple input connection points (left and right)

### 2. **Multiple Connections & Manual Rewiring**

#### **Manual Connection Mode** 🔌
- Click **"Manual Connect"** button to enter connection mode
- Connection points turn **blue** (inputs) and **green** (outputs)
- Click any output point, then click any input point to create connection
- Click **"Cancel Connect"** to exit connection mode

#### **Connection Management** ❌
- **Delete Connections**: Click directly on any connection line/arrow to remove it
- **Connection Labels**: Shows which nodes are connected (e.g., "Script → Voice")
- **Multiple Outputs**: Split nodes can connect to multiple destinations
- **Multiple Inputs**: Aggregate nodes can receive from multiple sources

### 3. **Replicate API Integration** 🎤

#### **Voice Generation with Replicate**
- Added **Replicate (Bark TTS)** as a voice service option
- Uses Suno AI's Bark model for high-quality voice synthesis
- Supports character voices and emotional expressions
- **Voice ID Format**: Use Bark voice presets like `v2/en_speaker_6`, `v2/en_speaker_9`, etc.

#### **Setup Requirements**
1. Get Replicate API key from [replicate.com](https://replicate.com)
2. Select "Replicate (Bark TTS)" in voice service dropdown
3. Use Bark voice presets as Voice IDs:
   - `v2/en_speaker_0` - Male voice
   - `v2/en_speaker_1` - Female voice  
   - `v2/en_speaker_6` - Character voice
   - `v2/en_speaker_9` - Different character voice

### 4. **Code Node** 💻

#### **Custom JavaScript Execution**
- **Purpose**: Transform data between automation nodes using custom JavaScript
- **Use Case**: Format data for JSON2Video, merge multiple data sources, custom logic
- **Example**: Convert audio files to JSON2Video format with background and titles
- **Visual**: Pink color with Code icon

#### **Built-in Utilities**
- `utils.toJSON2Video(audioFiles, template)` - Transform audio to video format
- `utils.mergeData(...sources)` - Merge multiple objects
- `utils.filterMap(array, filterFn, mapFn)` - Filter and transform arrays
- `utils.totalDuration(audioFiles)` - Calculate total audio duration
- `console.log()` - Debug logging

#### **Code Example for JSON2Video**:
```javascript
// Transform audio files to JSON2Video format
const audioFiles = input.audio_files || [];
const template = input.template || 'minecraft_chat';

// Use built-in utility to transform data
output = utils.toJSON2Video(audioFiles, template);

// Add background video if provided
if (input.background_video) {
  output.background = {
    type: 'video',
    src: input.background_video,
    loop: true
  };
}

// Add title if provided
if (input.title) {
  output.title = {
    text: input.title,
    duration: 3,
    position: 'top'
  };
}
```

## 🎯 Example Workflow: YouTube Video Creation

```
[Chat Message Trigger] 
        ↓
[Script Generator] 
        ↓
    [Split Out] ────┬─── [Voice Gen (Stewie)] ──┐
                    │                           │
                    └─── [Voice Gen (Peter)] ───┤
                                               │
                                        [Aggregate]
                                               ↓
                                         [Code Node]
                                               ↓
                                      [Video Renderer]
                                               ↓
                                       [Upload to Drive]
```

### **Updated Workflow with Code Node**:
1. **Script Generator** creates dialogue
2. **Split Out** divides the workflow  
3. **Two Voice Generators** run simultaneously
4. **Aggregate** waits for both to complete
5. **Code Node** transforms audio data to JSON2Video format
6. **Video Renderer** uses the formatted data
7. **Upload** saves the final video

## 🔄 How Split/Aggregate Works

### **Parallel Processing Example**:
1. **Script Generator** creates dialogue
2. **Split Out** divides the workflow
3. **Two Voice Generators** run simultaneously:
   - One generates Stewie's voice
   - One generates Peter's voice  
4. **Aggregate** waits for both to complete
5. **Code Node** formats data for JSON2Video
6. **Video Renderer** combines both audio files
7. **Upload** saves the final video

### **Benefits**:
- ⚡ **Faster**: Parallel processing instead of sequential
- 🔄 **Flexible**: Create complex branching workflows
- 🎯 **Efficient**: Don't wait for unrelated tasks
- 💻 **Customizable**: Transform data exactly as needed

## 🛠 Connection Tips

### **Best Practices**:
- Use **Split Out** when you need parallel processing
- Use **Aggregate** to synchronize parallel paths
- Use **Code Node** to transform data between incompatible nodes
- **Manual Connect** for complex routing
- **Auto Connect** for simple linear workflows

### **Connection Rules**:
- Triggers can only have outputs (no inputs)
- Most nodes have both input and output
- Split nodes have 1 input, multiple outputs
- Aggregate nodes have multiple inputs, 1 output
- Code nodes have 1 input, 1 output

## 🎬 Voice Service Comparison

| Service | Quality | Speed | Cost | Character Voices |
|---------|---------|-------|------|------------------|
| **ElevenLabs** | ⭐⭐⭐⭐⭐ | Fast | $$$ | Excellent |
| **OpenAI TTS** | ⭐⭐⭐⭐ | Fast | $$ | Good |
| **Replicate (Bark)** | ⭐⭐⭐⭐ | Slow | $ | Excellent |
| **Azure Speech** | ⭐⭐⭐ | Fast | $$ | Good |
| **Google Cloud** | ⭐⭐⭐ | Fast | $$ | Good |

## 🚀 Getting Started

1. **Create New Automation** in the workflow builder
2. **Drag nodes** from the sidebar to the canvas
3. **Use Manual Connect** to create custom connections
4. **Configure each node** by clicking the settings icon
5. **Add Code nodes** to transform data between services
6. **Test your workflow** with the preview button
7. **Activate** when ready to go live

## 🔧 Troubleshooting

### **Connection Issues**:
- Make sure you're in "Manual Connect" mode
- Click output (green) first, then input (blue)
- Check that connection doesn't already exist

### **Split/Aggregate Issues**:
- Aggregate nodes wait for ALL inputs to complete
- Make sure all parallel paths eventually reach the aggregate
- Use multiple aggregate nodes for complex branching

### **Code Node Issues**:
- Always set `output` variable in your code
- Use `input` to access data from previous node
- Test code with sample data first
- Check console for error messages

### **Replicate API Issues**:
- Replicate is slower (async processing)
- Check your API key is valid
- Use correct Bark voice preset format

---

**Need Help?** The workflow builder now supports complex automation patterns like the YouTube video creation workflow you wanted! 🎉