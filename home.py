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
urlvoid_api_key = os.getenv("URLVOID_API_KEY")

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
    output = netloc + parsed_url.path
    url_parts = output.split('/')
    output = url_parts[0]
    return output

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

    print('hellooodsf')
    #asks chatgpt is the website is trustable or not
    prompt = f"Answer in a JSON format boolean. Is {stripped_url} a scam website? respond in a format where key is: is_safe and value is boolean. Return it without the ``` json. Start with just the curly brackets. If it's a popular website always return true."
    ai_response = get_completion(prompt)
    print("ai response: ", ai_response)

    #gets chatgpt's response
    data = json.loads(ai_response)
    is_safe_in_chatgpt = data.get('is_safe')

    urlvoid_endpoint = f"https://endpoint.apivoid.com/domainbl/v1/pay-as-you-go/?key={urlvoid_api_key}&host={stripped_url}"
    response = requests.get(urlvoid_endpoint)
    urlvoid_data = response.json()

    #if url is invalid it'll redirect to error page
    if "error" in urlvoid_data and urlvoid_data["error"] == "Host is not valid":
        return redirect('/check?error=invalid_url')

    #retrieving detection count in urlvoid api
    detection_count = urlvoid_data['data']['report']['blacklists']['detections']
    
    # if score == 2, it means its super safe. score == 0 means dangerous
    score = 0
    if is_safe_in_chatgpt:
        score += 1
    if detection_count == 0 or detection_count == 1:
        score += 1
    print(score)

    return render_template('check_result.html', detection_count=detection_count, url=stripped_url, score=score)

@app.route('/check?error=invalid_url')
def go_back():
    return redirect('/check')

@app.route('/check/result/chrome')
def chrome_result():
    #sets the url query param
    #/check/result?url=
    print("This is jeina ele")
    url = request.args.get('url')
    stripped_url = strip_scheme(url)
    
    print("stripped", stripped_url)

    #asks chatgpt is the website is trustable or not
    prompt = f"Answer in a JSON format boolean. Is {stripped_url} a scam website? respond in a format where key is: is_safe and value is boolean. Return it without the ``` json. Start with just the curly brackets. If it's a popular website always return true."
    ai_response = get_completion(prompt)
    print("ai response: ", ai_response)
    #gets chatgpt's response
    data = json.loads(ai_response)
    is_safe_in_chatgpt = data.get('is_safe')

    urlvoid_endpoint = f"https://endpoint.apivoid.com/domainbl/v1/pay-as-you-go/?key={urlvoid_api_key}&host={stripped_url}"
    response = requests.get(urlvoid_endpoint)
    urlvoid_data = response.json()
    print("urlvodd data", urlvoid_data)

    #if url is invalid it'll redirect to error page
    if "error" in urlvoid_data and urlvoid_data["error"] == "Host is not valid":
        return redirect('/check/result/chrome?error=invalid_url')

    #retrieving detection count in urlvoid api
    detection_count = urlvoid_data['data']['report']['blacklists']['detections']
    
    # if score == 2, it means its super safe. score == 0 means dangerous
    score = 0
    if is_safe_in_chatgpt:
        score += 1

    if detection_count == 0 or detection_count == 1:
        score += 1
    print(score)

    return render_template('check_result_chrome.html', detection_count=detection_count, url=stripped_url, score=score)

if __name__ == "__main__":
    app.run(debug=True)