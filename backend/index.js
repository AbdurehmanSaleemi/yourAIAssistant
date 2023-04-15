import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { Configuration, OpenAIApi } from "openai";
import { storeData, searchData } from "./supabase.js"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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


app.listen(PORT, (error) => {
    console.log(`Server is running on port ${PORT}`);
});