from flask import Flask, render_template, request, redirect
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import openai
import os
from urllib.parse import urlparse
import json

app = Flask(__name__)

#grabs openai api from .env into home.py
load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")

def get_completion(prompt, model="gpt-4o"):
    # Prepare the messages for the API call
    messages = [{"role": "user", "content": prompt}]
    # Make the API call
    response = openai.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0
    )
    # Return the content of the response
    return response.choices[0].message.content

#shortens input url to just its domain and path
#ex: www.youtube.com --> youtube.com
def strip_scheme(url):
    parsed_url = urlparse(url)
    netloc = parsed_url.netloc
    if netloc.startswith('www.'):
        netloc = netloc[4:]
    return netloc + parsed_url.path

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/try')
def try_me():
    return redirect('/check')

@app.route('/github')
def github():
    return render_template('github.html')

@app.route('/github')
def github_home():
    return redirect('/')

@app.route('/check')
def checker():
    error = request.args.get('error')
    return render_template('check.html', error=error)

@app.route('/check/result')
def result():
    #sets the url query param
    #/check/result?url=
    url = request.args.get('url')
    stripped_url = strip_scheme(url)

    #asks chatgpt is the website is trustable or not
    prompt = f"Answer in a JSON format boolean. Is {stripped_url} a scam website? respond in a format where key is: is_safe and value is boolean. Return it without the ``` json. Start with just the curly brackets. If it's a popular website always return true."
    ai_response = get_completion(prompt)
    print("ai response: ", ai_response)
    #gets chatgpt's response
    data = json.loads(ai_response)
    is_safe_in_chatgpt = data.get('is_safe')

    #sends the form input to urlvoid
    data = {
        'site': stripped_url
    }

    page_to_scrape = requests.post('https://www.urlvoid.com', data=data)
    soup = BeautifulSoup(page_to_scrape.text, 'html.parser')
    detections = 0
    detections = soup.findAll("span", attrs={"class":"label"})
    #if length of detections is equal to 0, an error will pop up because the list is empty
    if len(detections) == 0:
        return redirect('/check?error=invalid_url')
    detection_count = detections[0].text

    safe_detection_counts = {"0/40", "1/40"}
    is_safe_in_urlvoid = (detection_count in safe_detection_counts) 
    
    # if score == 2, it means its super safe. score == 0 means dangerous
    score = 0
    if is_safe_in_chatgpt:
        score = score + 1

    if is_safe_in_urlvoid:
        score = score + 1

    return render_template('check_result.html', detection_count=detection_count, url=stripped_url, score=score)

@app.route('/check?error=invalid_url')
def go_back():
    return redirect('/check')

@app.route('/check/result/chrome')
def chrome_result():
    #sets the url query param
    #/check/result?url=
    url = request.args.get('url')
    stripped_url = strip_scheme(url)

    #asks chatgpt is the website is trustable or not
    prompt = f"Answer in a JSON format boolean. Is {stripped_url} a scam website? respond in a format where key is: is_safe and value is boolean. Return it without the ``` json. Start with just the curly brackets. If it's a popular website always return true."
    ai_response = get_completion(prompt)
    print("ai response: ", ai_response)
    #gets chatgpt's response
    data = json.loads(ai_response)
    is_safe_in_chatgpt = data.get('is_safe')

    #sends the form input to urlvoid
    data = {
        'site': stripped_url
    }

    page_to_scrape = requests.post('https://www.urlvoid.com', data=data)

    soup = BeautifulSoup(page_to_scrape.text, 'html.parser')

    detections = 0
    detections = soup.findAll("span", attrs={"class":"label"})
    #if length of detections is equal to 0, an error will pop up because the list is empty
    if len(detections) == 0:
        return redirect('/check?error=invalid_url')
    detection_count = detections[0].text

    safe_detection_counts = {"0/40", "1/40"}
    is_safe_in_urlvoid = (detection_count in safe_detection_counts) 
    
    # if score == 2, it means its super safe. score == 0 means dangerous
    score = 0
    if is_safe_in_chatgpt:
        score = score + 1

    if is_safe_in_urlvoid:
        score = score + 1
    print(score)

    return render_template('check_result_chrome.html', detection_count=detection_count, url=stripped_url, score=score)

if __name__ == "__main__":
    app.run(debug=True)