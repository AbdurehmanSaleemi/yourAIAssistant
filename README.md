# Your Personal AI Assistant

Last week, i found really interesting project to try out (during my midterm exams :)  ). The idea is to make something that help people using OpenAI tech. So after few google searches, i noticed people are really frustrated by some limitation of ChatGPT that is limited knowledge and inability to learn from large dataset of user.

That's when i discovered open source project Langchain. LangChain is a framework for developing applications powered by language models. Main purpose of langchain was: 

-   _Be data-aware_: connect a language model to other sources of data
-   _Be agentic_: allow a language model to interact with its environment

The LangChain framework is designed with the above principles in mind.


# Basics :

So the first question in the problem was 

 - How to connect data so that AI understands it and give answer according to the given context ?
 So the answer of it lies in power of embeddings and vector stores.
Lets explore them one by one

- What is Embeddings ?
	- Embeddings can be used to create a numerical representation of textual data. This numerical representation is useful because it can be used to find similar documents.
	
- What is Vector Store?
	- A vector store is a particular type of database optimized for storing documents and their [embeddings](https://js.langchain.com/docs/modules/models/embeddings/), and then fetching of the most relevant documents for a particular query, ie. those whose embeddings are most similar to the embedding of the query.

So by using just these two you can connect Large Language Models such as ChatGPT-3.5 to external data source and can generate results using your provided context

Examples:
- Company can store their financial records as vectors and then ask ChatGPT to comment on their financial performance in last two months
- User can upload large amount of PDF's as vectors and can ask  LLM (Large Language Model) about specific questions from the PDFs

## Process

This thing might seem really interest and hard as well. I'll not lie to you. It was hard to figure out but thanks to some youtube creators and open source community to make it look like simple

Here are the steps anyone can follow to make ChatGPT their own personal assistant
- **Step One** : Prepare the data you need to convert into Embeddings and store them on Vector Store. In my given code, i simply downloaded a journal on AI Topic and used it as my source of data
- **Step Two**: Now you need to find a model or way to convert that data to Embeddings. Its fairly simple. Use OpenAI embedding model to convert your data into vector form. (OpenAI will charge you for each conversion and it's really cheap)
- **Step Three**: Now you need Vector Store to store your embeddings in database. You can read more about vectors on LangchainJS docs: [VECTOR STORES](https://js.langchain.com/docs/modules/indexes/vector_stores/) . In my example code, I am using supabase.  
- **Step Four (Last)**: Now you will get user input and convert user input into embeddings and will run supabase custom embeddings search function (you can find it below) to search closest related embeddings (data) that matches user input. (Semantic Search)


## How you can do it  ?

## Step 1: Prepare Database (Supabase)

Create an account on Supabase and after that create a new project. After creating new project, simply go to SQL Editor and paste this query :
```SQL
 -- Enable the pgvector extension to work with embedding vectors  
    create extension vector;  
      
    -- Create a table to store your documents  
    create  table documents (  
    id bigserial primary  key,  
    content text,  -- corresponds to Document.pageContent  
    metadata jsonb,  -- corresponds to Document.metadata  
    embedding vector(1536)  -- 1536 works for OpenAI embeddings, change if needed  
    );  
      
    -- Create a function to search for documents  
    create  function match_documents (  
    query_embedding vector(1536),  
    match_count int  
    )  returns  table  (  
    id bigint,  
    content text,  
    metadata jsonb,  
    similarity float  
    )  
    language plpgsql  
    as $$  
    #variable_conflict use_column  
    begin  
    return query  
    select  
    id,  
    content,  
    metadata,  
    1  -  (documents.embedding <=> query_embedding)  as similarity  
    from documents  
    order  by documents.embedding <=> query_embedding  
    limit match_count;  
    end;  
    $$;
```
   Run this query and it will return a new table named "documents" and function "match_documents"

Table `documents` will store our lines and paragraphs and their vectors
Function `match_documents` will match user query with table data and return most appropriate result.

## 2nd Step : Backend (NodeJS)

Now we have to build actual tool that'll use all power of Langchain to get what we wanted.
But instead of going this path, i went with my own idea
So my idea was fairly simple
- Divide the data using Langchain TextSplitter Function
- Generate its Embeddings using OpenAI API
- Upload them to supabase
- Search through data everytime user enters something and return results

Here is the code of it :

```javascript
// Initialize the OpenAI API
const config = new Configuration({
    apiKey: process.env.OPENAI_KEY
});
const openai = new OpenAIApi(config);
const PORT = process.env.PORT || 3001;

// Load the documents from the pdf file
const loader = new PDFLoader("journal.pdf", {
    // you may need to add `.then(m => m.default)` to the end of the import
    pdfjs: () => import("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js"),
});
const docs = await loader.load();

// Split the documents into chunks of 4000 characters with an overlap of 200 characters
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 4000,
    chunkOverlap: 200,
});


// Function to get the embeddings of the documents and store them in the database

const getEmbeddings = async () => {
    for (var i = 0; i < docs.length; i++) {
        const chunks = await splitter.createDocuments([docs[i].pageContent]);
        // remove non-ascii characters

        chunks.forEach((chunk) => {
            chunk.pageContent = chunk.pageContent.replace(/\x00/g, '');
        });
        console.log(chunks);

        for (let j = 0; j < chunks.length; j++) {
            const embeddings = await openai.createEmbedding({
                model: "text-embedding-ada-002",
                input: chunks[j].pageContent,
            });
            storeData(chunks[j].pageContent, embeddings.data.data[0].embedding);
        }
        console.log(i);
    }
}

// run this only once to get the embeddings of the documents and store them in the database and after that comment it out

//getEmbeddings();



const createUserEmbedding = async (input) => {
    const userEmbedding = await openai.createEmbedding({
        model: "text-embedding-ada-002",
        input: input,
    });
    return userEmbedding;
}

const generateResponse = async (input, context) => {
    const response = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "assistant",
                content: `Answer user question: ${input} using context: ${context}. Dont user your own knowledge.`,
            }
        ]
    });
    return response;
}
```

So in this simple example we are loading PDF file using PDFLoader provided by Langchain & Also using TextSplitter to split the text into chunks of data.

I wrote the comment codes so you can understand it better.

So here is the API endpoint i have created

```javascript
app.post('/', async (req, res) => {
        const { query } = req.body;
        const userEmbedding = await createUserEmbedding(query);
        const [{ embedding }] = userEmbedding.data.data;
        console.log(query);
        const result = await searchData(embedding);
        const fin = await generateResponse(query, result[0].content);
        console.log(fin.data.choices[0].message.content);
        res.send(
            {
                result: fin.data.choices[0].message.content
            }
        );
    });
```

You will find functions such as `searchData()` and `storeData()` in supabase.js file

So this little server will generate response and will send to the frontend (you can see frontend code on this repo)

## Running my code
Simply clone the repo <br/>
`git clone https://github.com/AbdurehmanSaleemi/yourAIAssistant.git` <br/>
Navigate into cloned folder and then to backend <br/>
`cd yourAIAssistant` <br/>
`cd backend` <br/>

Type `npm install`
then type `npm start`

Now the local server will start on port 3001 and you can start frontend too
Now navigate back to root of the folder
<br/>
Type `npm run dev` and it'll run the development server and will also show you port and address
I am using VITE BUILD TOOL for react frontend

That's it from my side.
If you like it or find it helpful, Star it.

You can fork it and can also suggest improvements.
Thank you.
